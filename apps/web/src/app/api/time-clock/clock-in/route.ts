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

    // Get request body for is_sick flag
    const body = await request.json().catch(() => ({}))
    const isSick = body.is_sick === true

    // Get user data
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    // Check if user already has an active clock-in (no clock_out)
    const { data: activeEntry } = await supabase
      .from('time_clock_entries')
      .select('id')
      .eq('user_id', userData.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeEntry) {
      return NextResponse.json({ 
        error: { message: 'You already have an active clock-in. Please clock out first.' } 
      }, { status: 400 })
    }

    const clockInTime = new Date()
    
    // Find matching shift for today (±30 minutes tolerance)
    const todayStart = new Date(clockInTime)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(clockInTime)
    todayEnd.setHours(23, 59, 59, 999)

    const shiftStart = new Date(clockInTime)
    shiftStart.setMinutes(shiftStart.getMinutes() - 30)
    const shiftEnd = new Date(clockInTime)
    shiftEnd.setMinutes(shiftEnd.getMinutes() + 30)

    const { data: shifts } = await supabase
      .from('shifts')
      .select('id, start_time, end_time')
      .eq('user_id', userData.id)
      .eq('organization_id', userData.organization_id)
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .order('start_time', { ascending: true })

    // Find the closest matching shift within tolerance
    let matchingShift = null
    if (shifts && shifts.length > 0) {
      for (const shift of shifts) {
        const shiftStartTime = new Date(shift.start_time)
        if (shiftStartTime >= shiftStart && shiftStartTime <= shiftEnd) {
          matchingShift = shift
          break
        }
      }
      // If no exact match, take the closest one
      if (!matchingShift && shifts.length > 0) {
        const sorted = shifts.sort((a, b) => {
          const diffA = Math.abs(new Date(a.start_time).getTime() - clockInTime.getTime())
          const diffB = Math.abs(new Date(b.start_time).getTime() - clockInTime.getTime())
          return diffA - diffB
        })
        matchingShift = sorted[0]
      }
    }

    let shiftId: string | null = null
    let shiftStartTime: Date | null = null
    let shiftEndTime: Date | null = null
    let clockInDeviation: number | null = null
    let hasWarning = false

    if (matchingShift) {
      shiftId = matchingShift.id
      shiftStartTime = new Date(matchingShift.start_time)
      shiftEndTime = new Date(matchingShift.end_time)
      
      // Calculate deviation in minutes
      const deviationMs = clockInTime.getTime() - shiftStartTime.getTime()
      clockInDeviation = Math.round(deviationMs / (1000 * 60))
      
      // Warn if deviation > 30 minutes
      if (Math.abs(clockInDeviation) > 30) {
        hasWarning = true
      }
    } else {
      // No shift found within ±30 minutes - show warning
      hasWarning = true
    }

    // For sick days, set clock_out to end of day (23:59:59) to mark the whole day as sick
    let clockOutTime: Date | null = null
    if (isSick) {
      clockOutTime = new Date(clockInTime)
      clockOutTime.setHours(23, 59, 59, 999)
    }

    // Create time clock entry
    const { data: timeEntry, error: insertError } = await supabase
      .from('time_clock_entries')
      .insert({
        organization_id: userData.organization_id,
        user_id: userData.id,
        shift_id: shiftId,
        clock_in: clockInTime.toISOString(),
        clock_out: clockOutTime?.toISOString() || null,
        shift_start_time: shiftStartTime?.toISOString() || null,
        shift_end_time: shiftEndTime?.toISOString() || null,
        clock_in_deviation_minutes: clockInDeviation,
        has_warning: hasWarning,
        is_sick: isSick
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create time clock entry:', insertError)
      return NextResponse.json({ error: { message: 'Failed to clock in' } }, { status: 500 })
    }

    let warningMessage: string | null = null
    if (hasWarning) {
      if (!matchingShift) {
        warningMessage = 'Keine Schicht geplant für diesen Zeitpunkt (±30 Minuten)'
      } else if (clockInDeviation) {
        warningMessage = `Abweichung von ${Math.abs(clockInDeviation)} Minuten zur geplanten Schicht`
      }
    }

    return NextResponse.json({ 
      entry: timeEntry,
      warning: warningMessage
    })
  } catch (error) {
    console.error('Clock in error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

