import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/shifts - Get all shifts for the organization
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

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const userId = searchParams.get('user_id')
    const status = searchParams.get('status')

    // Build query - include time_clock_entries
    let query = supabase
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
        ),
        time_clock_entries:time_clock_entries!time_clock_entries_shift_id_fkey(
          id,
          clock_in,
          clock_out,
          clock_in_deviation_minutes,
          clock_out_deviation_minutes,
          has_warning,
          is_approved
        )
      `)
      .eq('organization_id', userData.organization_id)
      .order('start_time', { ascending: true })

    // Filter by user if specified
    if (userId) {
      query = query.eq('user_id', userId)
    }
    // Note: Staff can see all shifts in their organization (removed restriction)

    // Filter by date range
    if (startDate) {
      query = query.gte('start_time', startDate)
    }
    if (endDate) {
      query = query.lte('start_time', endDate)
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    const { data: shifts, error: shiftsError } = await query

    if (shiftsError) {
      console.error('Shifts fetch error:', shiftsError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch shifts' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ shifts: shifts || [] })
  } catch (error) {
    console.error('Shifts API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/shifts - Create a new shift
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, start_time, end_time, position_id, position, hourly_rate, notes, status } = body

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

    // Check if user has permission to create shifts
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions. Only managers and owners can create shifts.' } },
        { status: 403 }
      )
    }

    // Validate required fields - position_id is required, user_id is optional (open shift)
    if (!start_time || !end_time) {
      return NextResponse.json(
        { error: { message: 'start_time and end_time are required' } },
        { status: 400 }
      )
    }

    // If user_id is provided, verify that the target user belongs to the same organization
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
          { error: { message: 'Cannot create shift for user from different organization' } },
          { status: 403 }
        )
      }
    }

    // If position_id is provided, verify it belongs to the same organization
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

    // Validate dates
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

    // Create shift
    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .insert({
        organization_id: userData.organization_id,
        user_id: user_id || null, // Null for open shifts
        start_time: start_time,
        end_time: end_time,
        position_id: position_id || null,
        position: position || null, // Legacy field, keep for compatibility
        hourly_rate: hourly_rate || null,
        notes: notes || null,
        status: status || 'scheduled',
        created_by: userData.id
      })
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
      console.error('Shift creation error:', shiftError)
      return NextResponse.json(
        { error: { message: 'Failed to create shift' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ shift }, { status: 201 })
  } catch (error) {
    console.error('Shift creation API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

