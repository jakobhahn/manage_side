import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/vacation/monthly-summary - Get monthly employee summary
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
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const month = searchParams.get('month') // Optional: filter by specific month

    // Build query - use regular view (materialized view might be empty)
    let query = supabase
      .from('monthly_employee_summary')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .eq('year', parseInt(year))

    // Staff can only see their own summary
    if (userData.role === 'staff') {
      query = query.eq('user_id', userData.id)
    } else if (userId) {
      query = query.eq('user_id', userId)
    }

    // Filter by month if specified
    if (month) {
      query = query.eq('month_number', parseInt(month))
    }

    query = query.order('month', { ascending: false })
      .order('employee_name', { ascending: true })

    const { data: summary, error: summaryError } = await query

    if (summaryError) {
      console.error('Monthly summary fetch error:', summaryError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch monthly summary', details: summaryError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ summary: summary || [] })
  } catch (error) {
    console.error('Monthly summary API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

