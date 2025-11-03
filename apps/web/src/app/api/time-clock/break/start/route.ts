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
        error: { message: 'Keine aktive Einstempelung gefunden. Bitte stempeln Sie zuerst ein.' } 
      }, { status: 400 })
    }

    // Check if user already has an active break
    const { data: activeBreak } = await supabase
      .from('time_clock_breaks')
      .select('id')
      .eq('time_clock_entry_id', activeEntry.id)
      .is('break_end', null)
      .maybeSingle()

    if (activeBreak) {
      return NextResponse.json({ 
        error: { message: 'Sie haben bereits eine aktive Pause.' } 
      }, { status: 400 })
    }

    const breakStartTime = new Date()

    // Create break entry
    const { data: breakEntry, error: insertError } = await supabase
      .from('time_clock_breaks')
      .insert({
        organization_id: userData.organization_id,
        user_id: userData.id,
        time_clock_entry_id: activeEntry.id,
        break_start: breakStartTime.toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create break entry:', insertError)
      return NextResponse.json({ error: { message: 'Failed to start break' } }, { status: 500 })
    }

    return NextResponse.json({ 
      break: breakEntry,
      message: 'Pause gestartet'
    })
  } catch (error) {
    console.error('Break start error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}


