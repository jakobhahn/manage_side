import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: { message: 'Authorization token required' } }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: { message: 'Invalid token' } }, { status: 401 })
    }

    // Get user data
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    // Build query - filter by organization_id and user_id (for staff)
    let query = supabase
      .from('time_clock_entries')
      .select(`
        *,
        user:users!time_clock_entries_user_id_fkey(id, name, email),
        shift:shifts!time_clock_entries_shift_id_fkey(id, start_time, end_time, position, status),
        approved_by_user:users!time_clock_entries_approved_by_fkey(id, name)
      `)
      .eq('organization_id', userData.organization_id)

    // Staff can only see their own entries - filter by user_id
    if (userData.role === 'staff') {
      query = query.eq('user_id', userData.id)
    }

    query = query
      .order('clock_in', { ascending: false })
      .limit(100)

    const { data: entries, error: entriesError } = await query

    if (entriesError) {
      console.error('Failed to fetch time clock entries:', entriesError)
      return NextResponse.json({ error: { message: 'Failed to fetch entries' } }, { status: 500 })
    }

    // Debug: Log the query results to verify filtering
    console.log('Time clock entries query:', {
      userId: userData.id,
      userRole: userData.role,
      organizationId: userData.organization_id,
      entriesCount: entries?.length || 0,
      entryUserIds: entries?.map((e: any) => e.user_id) || []
    })

    // Double-check: Filter entries by user_id for staff (additional safety check)
    let filteredEntries = entries || []
    if (userData.role === 'staff') {
      filteredEntries = filteredEntries.filter((entry: any) => entry.user_id === userData.id)
    }

    return NextResponse.json({ entries: filteredEntries })
  } catch (error) {
    console.error('Time clock entries fetch error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}






