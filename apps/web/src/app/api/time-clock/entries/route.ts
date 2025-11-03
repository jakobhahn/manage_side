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

    // Build query
    let query = supabase
      .from('time_clock_entries')
      .select(`
        *,
        user:user_id(id, name, email),
        shift:shift_id(id, start_time, end_time, position, status),
        approved_by_user:approved_by(id, name)
      `)
      .eq('organization_id', userData.organization_id)
      .order('clock_in', { ascending: false })
      .limit(100)

    // Staff can only see their own entries
    if (userData.role === 'staff') {
      query = query.eq('user_id', userData.id)
    }

    const { data: entries, error: entriesError } = await query

    if (entriesError) {
      console.error('Failed to fetch time clock entries:', entriesError)
      return NextResponse.json({ error: { message: 'Failed to fetch entries' } }, { status: 500 })
    }

    return NextResponse.json({ entries: entries || [] })
  } catch (error) {
    console.error('Time clock entries fetch error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}


