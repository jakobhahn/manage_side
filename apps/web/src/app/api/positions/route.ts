import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/positions - Get all positions for the organization
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

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization_id
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('include_inactive') === 'true'

    // Build query
    let query = supabase
      .from('positions')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: positions, error: positionsError } = await query

    if (positionsError) {
      console.error('Positions fetch error:', positionsError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch positions' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ positions: positions || [] })
  } catch (error) {
    console.error('Positions API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/positions - Create a new position
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, color } = body

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
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions. Only managers and owners can create positions.' } },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: { message: 'name is required' } },
        { status: 400 }
      )
    }

    // Create position
    const { data: position, error: positionError } = await supabase
      .from('positions')
      .insert({
        organization_id: userData.organization_id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        is_active: true
      })
      .select()
      .single()

    if (positionError) {
      console.error('Position creation error:', positionError)
      if (positionError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: { message: 'A position with this name already exists' } },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: { message: 'Failed to create position' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ position }, { status: 201 })
  } catch (error) {
    console.error('Position creation API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}






