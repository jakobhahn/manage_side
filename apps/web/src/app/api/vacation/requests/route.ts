import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/vacation/requests - Get all vacation requests
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
    const userId = searchParams.get('user_id')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Build query
    let query = supabase
      .from('vacation_requests')
      .select(`
        *,
        user:users!vacation_requests_user_id_fkey(
          id,
          name,
          email
        ),
        reviewed_by_user:users!vacation_requests_reviewed_by_fkey(
          id,
          name
        )
      `)
      .eq('organization_id', userData.organization_id)
      .order('requested_at', { ascending: false })

    // Staff can only see their own requests
    if (userData.role === 'staff') {
      query = query.eq('user_id', userData.id)
    } else if (userId) {
      query = query.eq('user_id', userId)
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('start_date', startDate)
    }
    if (endDate) {
      query = query.lte('end_date', endDate)
    }

    const { data: requests, error: requestsError } = await query

    if (requestsError) {
      console.error('Vacation requests fetch error:', requestsError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch vacation requests' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ requests: requests || [] })
  } catch (error) {
    console.error('Vacation requests API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/vacation/requests - Create a new vacation request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { start_date, end_date, reason } = body

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

    // Validate required fields
    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: { message: 'start_date and end_date are required' } },
        { status: 400 }
      )
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (endDate < startDate) {
      return NextResponse.json(
        { error: { message: 'end_date must be after start_date' } },
        { status: 400 }
      )
    }

    // Calculate number of days (excluding weekends - can be enhanced later)
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Check if user has enough vacation days
    const currentYear = new Date().getFullYear()
    const { data: balance } = await supabase
      .from('vacation_balances')
      .select('total_days, used_days, remaining_days')
      .eq('organization_id', userData.organization_id)
      .eq('user_id', userData.id)
      .eq('year', currentYear)
      .single()

    if (balance && balance.remaining_days < days) {
      return NextResponse.json(
        { error: { message: `Not enough vacation days. You have ${balance.remaining_days} days remaining, but requested ${days} days.` } },
        { status: 400 }
      )
    }

    // Check for overlapping requests
    // Two date ranges overlap if: new_start <= existing_end AND new_end >= existing_start
    const { data: existingRequests } = await supabase
      .from('vacation_requests')
      .select('id, start_date, end_date')
      .eq('user_id', userData.id)
      .in('status', ['pending', 'approved'])

    if (existingRequests && existingRequests.length > 0) {
      const hasOverlap = existingRequests.some(existing => {
        const existingStart = new Date(existing.start_date)
        const existingEnd = new Date(existing.end_date)
        // Check if ranges overlap: new range overlaps if it starts before existing ends AND ends after existing starts
        return startDate <= existingEnd && endDate >= existingStart
      })

      if (hasOverlap) {
        return NextResponse.json(
          { error: { message: 'You already have a pending or approved vacation request that overlaps with this period' } },
          { status: 400 }
        )
      }
    }

    // Create the request
    const { data: newRequest, error: createError } = await supabase
      .from('vacation_requests')
      .insert({
        organization_id: userData.organization_id,
        user_id: userData.id,
        start_date: start_date,
        end_date: end_date,
        days: days,
        reason: reason || null,
        status: 'pending'
      })
      .select(`
        *,
        user:users!vacation_requests_user_id_fkey(
          id,
          name,
          email
        )
      `)
      .single()

    if (createError) {
      console.error('Failed to create vacation request:', createError)
      return NextResponse.json(
        { error: { message: 'Failed to create vacation request' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ request: newRequest }, { status: 201 })
  } catch (error) {
    console.error('Vacation request creation error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

