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
      .select('id, clock_in, shift_id, shift_end_time, has_warning')
      .eq('user_id', userData.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError || !activeEntry) {
      return NextResponse.json({ 
        error: { message: 'No active clock-in found. Please clock in first.' } 
      }, { status: 400 })
    }

    // Check if user has an active break (pause)
    const { data: activeBreak } = await supabase
      .from('time_clock_breaks')
      .select('id')
      .eq('time_clock_entry_id', activeEntry.id)
      .is('break_end', null)
      .maybeSingle()

    if (activeBreak) {
      return NextResponse.json({ 
        error: { message: 'Bitte beenden Sie zuerst die aktive Pause.' } 
      }, { status: 400 })
    }

    const clockOutTime = new Date()
    
    let clockOutDeviation: number | null = null
    let hasWarning = activeEntry.has_warning || false

    // If there's a planned shift end time, calculate deviation
    if (activeEntry.shift_end_time) {
      const shiftEndTime = new Date(activeEntry.shift_end_time)
      const deviationMs = clockOutTime.getTime() - shiftEndTime.getTime()
      clockOutDeviation = Math.round(deviationMs / (1000 * 60))
      
      // Warn if deviation > 30 minutes (before or after shift end)
      if (Math.abs(clockOutDeviation) > 30) {
        hasWarning = true
      }
    } else {
      // No shift end time planned - show warning
      hasWarning = true
    }

    // Update time clock entry with clock_out
    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_clock_entries')
      .update({
        clock_out: clockOutTime.toISOString(),
        clock_out_deviation_minutes: clockOutDeviation,
        has_warning: hasWarning,
        updated_at: new Date().toISOString()
      })
      .eq('id', activeEntry.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update time clock entry:', updateError)
      return NextResponse.json({ error: { message: 'Failed to clock out' } }, { status: 500 })
    }

    let warningMessage: string | null = null
    if (hasWarning) {
      if (!activeEntry.shift_end_time) {
        warningMessage = 'Keine Schicht geplant für diesen Zeitpunkt'
      } else if (clockOutDeviation) {
        warningMessage = `Abweichung von ${Math.abs(clockOutDeviation)} Minuten zur geplanten Schicht`
      }
    }

    return NextResponse.json({ 
      entry: updatedEntry,
      warning: warningMessage
    })
  } catch (error) {
    console.error('Clock out error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

