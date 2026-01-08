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
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    // Find active clock-in entry
    const { data: activeEntry, error: findError } = await supabase
      .from('time_clock_entries')
      .select('id')
      .eq('user_id', userData.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError || !activeEntry) {
      return NextResponse.json({ break: null })
    }

    // Find active break
    const { data: activeBreak, error: breakFindError } = await supabase
      .from('time_clock_breaks')
      .select('id, break_start, break_end')
      .eq('time_clock_entry_id', activeEntry.id)
      .eq('user_id', userData.id)
      .is('break_end', null)
      .order('break_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (breakFindError) {
      console.error('Failed to fetch break:', breakFindError)
      return NextResponse.json({ break: null })
    }

    return NextResponse.json({ break: activeBreak || null })
  } catch (error) {
    console.error('Break status error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}






