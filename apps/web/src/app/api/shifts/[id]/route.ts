import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/shifts/[id] - Get a specific shift
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization_id and role
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role, id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Get shift
    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .select(`
        *,
        user:users!shifts_user_id_fkey(
          id,
          name,
          email
        ),
        created_by_user:users!shifts_created_by_fkey(
          id,
          name
        ),
        position:positions!shifts_position_id_fkey(
          id,
          name,
          color
        )
      `)
      .eq('id', id)
      .single()

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: { message: 'Shift not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission to view this shift
    if (shift.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Shift not found' } },
        { status: 404 }
      )
    }

    // Staff can only see their own shifts
    if (userData.role === 'staff' && shift.user_id !== userData.id) {
      return NextResponse.json(
        { error: { message: 'Shift not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ shift })
  } catch (error) {
    console.error('Shift fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// PUT /api/shifts/[id] - Update a shift
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { start_time, end_time, position_id, position, hourly_rate, notes, status, user_id } = body

    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization_id and role
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role, id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission to update shifts
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions. Only managers and owners can update shifts.' } },
        { status: 403 }
      )
    }

    // Get existing shift
    const { data: existingShift, error: existingShiftError } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single()

    if (existingShiftError || !existingShift) {
      return NextResponse.json(
        { error: { message: 'Shift not found' } },
        { status: 404 }
      )
    }

    // Check organization
    if (existingShift.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Shift not found' } },
        { status: 404 }
      )
    }

    // If user_id is being changed (including setting to null for open shifts), verify the new user belongs to the organization
    if (user_id !== undefined && user_id !== existingShift.user_id) {
      if (user_id) {
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
            { error: { message: 'Cannot assign shift to user from different organization' } },
            { status: 403 }
          )
        }
      }
    }

    // If position_id is being changed, verify it belongs to the organization
    if (position_id !== undefined && position_id !== existingShift.position_id) {
      if (position_id) {
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
      }
    }

    // Validate dates if provided
    if (start_time && end_time) {
      const startDate = new Date(start_time)
      const endDate = new Date(end_time)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: { message: 'Invalid date format' } },
          { status: 400 }
        )
      }

      if (endDate <= startDate) {
        return NextResponse.json(
          { error: { message: 'end_time must be after start_time' } },
          { status: 400 }
        )
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (start_time !== undefined) updateData.start_time = start_time
    if (end_time !== undefined) updateData.end_time = end_time
    if (position_id !== undefined) updateData.position_id = position_id
    if (position !== undefined) updateData.position = position // Legacy field
    if (hourly_rate !== undefined) updateData.hourly_rate = hourly_rate
    if (notes !== undefined) updateData.notes = notes
    if (status !== undefined) updateData.status = status
    if (user_id !== undefined) updateData.user_id = user_id || null // Allow null for open shifts

    // Update shift
    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        user:users!shifts_user_id_fkey(
          id,
          name,
          email
        ),
        created_by_user:users!shifts_created_by_fkey(
          id,
          name
        ),
        position:positions!shifts_position_id_fkey(
          id,
          name,
          color
        )
      `)
      .single()

    if (shiftError) {
      console.error('Shift update error:', shiftError)
      return NextResponse.json(
        { error: { message: 'Failed to update shift' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ shift })
  } catch (error) {
    console.error('Shift update API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// DELETE /api/shifts/[id] - Delete a shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization_id and role
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role, id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission to delete shifts
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions. Only managers and owners can delete shifts.' } },
        { status: 403 }
      )
    }

    // Get existing shift to verify organization
    const { data: existingShift, error: existingShiftError } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single()

    if (existingShiftError || !existingShift) {
      return NextResponse.json(
        { error: { message: 'Shift not found' } },
        { status: 404 }
      )
    }

    if (existingShift.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Shift not found' } },
        { status: 404 }
      )
    }

    // Delete shift
    const { error: deleteError } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Shift delete error:', deleteError)
      return NextResponse.json(
        { error: { message: 'Failed to delete shift' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Shift deleted successfully' })
  } catch (error) {
    console.error('Shift delete API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

