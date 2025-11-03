import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ 
        error: { message: 'Keine aktive Einstempelung gefunden.' } 
      }, { status: 400 })
    }

    // Find active break
    const { data: activeBreak, error: breakFindError } = await supabase
      .from('time_clock_breaks')
      .select('id')
      .eq('time_clock_entry_id', activeEntry.id)
      .eq('user_id', userData.id)
      .is('break_end', null)
      .order('break_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (breakFindError || !activeBreak) {
      return NextResponse.json({ 
        error: { message: 'Keine aktive Pause gefunden.' } 
      }, { status: 400 })
    }

    const breakEndTime = new Date()

    // Update break entry with break_end
    const { data: updatedBreak, error: updateError } = await supabase
      .from('time_clock_breaks')
      .update({
        break_end: breakEndTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', activeBreak.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update break entry:', updateError)
      return NextResponse.json({ error: { message: 'Failed to end break' } }, { status: 500 })
    }

    return NextResponse.json({ 
      break: updatedBreak,
      message: 'Pause beendet'
    })
  } catch (error) {
    console.error('Break end error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}


