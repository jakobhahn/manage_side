import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: { message: 'Authorization token required' } }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const body = await request.json()
    const { entryId, clock_in, clock_out } = body

    if (!entryId) {
      return NextResponse.json({ error: { message: 'Entry ID required' } }, { status: 400 })
    }

    if (!clock_in) {
      return NextResponse.json({ error: { message: 'Clock-in time required' } }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: { message: 'Invalid token' } }, { status: 401 })
    }

    // Get user data and check permissions
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    // Only managers and owners can update
    if (userData.role !== 'manager' && userData.role !== 'owner') {
      return NextResponse.json({ error: { message: 'Insufficient permissions' } }, { status: 403 })
    }

    // Get the entry to check organization_id
    const { data: existingEntry, error: fetchError } = await supabase
      .from('time_clock_entries')
      .select('id, organization_id, shift_id, shift_start_time, shift_end_time')
      .eq('id', entryId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (fetchError || !existingEntry) {
      return NextResponse.json({ error: { message: 'Entry not found' } }, { status: 404 })
    }

    // Recalculate deviations if shift times exist
    let clockInDeviation: number | null = null
    let clockOutDeviation: number | null = null
    let hasWarning = false

    if (existingEntry.shift_start_time) {
      const shiftStartTime = new Date(existingEntry.shift_start_time)
      const clockInTime = new Date(clock_in)
      const deviationMs = clockInTime.getTime() - shiftStartTime.getTime()
      clockInDeviation = Math.round(deviationMs / (1000 * 60))
      if (Math.abs(clockInDeviation) > 30) {
        hasWarning = true
      }
    } else {
      hasWarning = true
    }

    if (clock_out && existingEntry.shift_end_time) {
      const shiftEndTime = new Date(existingEntry.shift_end_time)
      const clockOutTime = new Date(clock_out)
      const deviationMs = clockOutTime.getTime() - shiftEndTime.getTime()
      clockOutDeviation = Math.round(deviationMs / (1000 * 60))
      if (Math.abs(clockOutDeviation) > 30) {
        hasWarning = true
      }
    } else if (clock_out && !existingEntry.shift_end_time) {
      hasWarning = true
    }

    // Update entry
    const updateData: any = {
      clock_in: clock_in,
      clock_in_deviation_minutes: clockInDeviation,
      has_warning: hasWarning,
      updated_at: new Date().toISOString()
    }

    if (clock_out) {
      updateData.clock_out = clock_out
      updateData.clock_out_deviation_minutes = clockOutDeviation
    }

    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_clock_entries')
      .update(updateData)
      .eq('id', entryId)
      .eq('organization_id', userData.organization_id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update time clock entry:', updateError)
      return NextResponse.json({ error: { message: 'Failed to update entry' } }, { status: 500 })
    }

    return NextResponse.json({ entry: updatedEntry })
  } catch (error) {
    console.error('Update time clock entry error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}


