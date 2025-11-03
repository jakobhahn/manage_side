import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/user-positions - Get position assignments for a user or all users
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    let query = supabase
      .from('user_positions')
      .select(`
        *,
        position:positions!user_positions_position_id_fkey(
          id,
          name,
          color,
          description
        ),
        user:users!user_positions_user_id_fkey(
          id,
          name,
          email
        )
      `)

    if (userId) {
      // Get positions for specific user
      query = query.eq('user_id', userId)
    } else {
      // Get all position assignments in organization
      // First, get all user IDs in the organization
      const { data: orgUsers } = await supabase
        .from('users')
        .select('id')
        .eq('organization_id', userData.organization_id)
      
      if (orgUsers && orgUsers.length > 0) {
        const userIds = orgUsers.map(u => u.id)
        query = query.in('user_id', userIds)
      } else {
        query = query.eq('user_id', '00000000-0000-0000-0000-000000000000') // No results
      }
    }

    const { data: assignments, error: assignmentsError } = await query

    if (assignmentsError) {
      console.error('User positions fetch error:', assignmentsError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch position assignments' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ assignments: assignments || [] })
  } catch (error) {
    console.error('User positions API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/user-positions - Assign position to user
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const body = await request.json()
    const { user_id, position_id } = body

    if (!user_id || !position_id) {
      return NextResponse.json(
        { error: { message: 'user_id and position_id are required' } },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check permission
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Verify target user belongs to same organization
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('id', user_id)
      .single()

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: { message: 'Target user not found' } },
        { status: 404 }
      )
    }

    if (targetUser.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Cannot assign position to user from different organization' } },
        { status: 403 }
      )
    }

    // Verify position belongs to same organization
    const { data: positionData, error: positionError } = await supabase
      .from('positions')
      .select('id, organization_id')
      .eq('id', position_id)
      .single()

    if (positionError || !positionData) {
      return NextResponse.json(
        { error: { message: 'Position not found' } },
        { status: 404 }
      )
    }

    if (positionData.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Cannot use position from different organization' } },
        { status: 403 }
      )
    }

    // Insert assignment (will fail if already exists due to UNIQUE constraint)
    const { data: assignment, error: assignmentError } = await supabase
      .from('user_positions')
      .insert({
        user_id,
        position_id
      })
      .select(`
        *,
        position:positions!user_positions_position_id_fkey(
          id,
          name,
          color,
          description
        )
      `)
      .single()

    if (assignmentError) {
      if (assignmentError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: { message: 'Position already assigned to this user' } },
          { status: 400 }
        )
      }
      console.error('User position assignment error:', assignmentError)
      return NextResponse.json(
        { error: { message: 'Failed to assign position' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ assignment })
  } catch (error) {
    console.error('User positions API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// DELETE /api/user-positions - Remove position assignment from user
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const position_id = searchParams.get('position_id')

    if (!user_id || !position_id) {
      return NextResponse.json(
        { error: { message: 'user_id and position_id are required' } },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check permission
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Verify assignment belongs to same organization
    const { data: assignment, error: assignmentError } = await supabase
      .from('user_positions')
      .select(`
        *,
        user:users!user_positions_user_id_fkey(
          organization_id
        )
      `)
      .eq('user_id', user_id)
      .eq('position_id', position_id)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: { message: 'Position assignment not found' } },
        { status: 404 }
      )
    }

    if (assignment.user.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Cannot delete assignment from different organization' } },
        { status: 403 }
      )
    }

    // Delete assignment
    const { error: deleteError } = await supabase
      .from('user_positions')
      .delete()
      .eq('user_id', user_id)
      .eq('position_id', position_id)

    if (deleteError) {
      console.error('User position deletion error:', deleteError)
      return NextResponse.json(
        { error: { message: 'Failed to remove position assignment' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Position assignment removed successfully' })
  } catch (error) {
    console.error('User positions API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

