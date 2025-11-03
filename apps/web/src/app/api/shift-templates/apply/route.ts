import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST /api/shift-templates/apply - Apply a template to a specific week
export async function POST(request: NextRequest) {
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

    // Only managers and owners can apply templates
    if (userData.role !== 'manager' && userData.role !== 'owner') {
      return NextResponse.json(
        { error: { message: 'Permission denied' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { template_id, week_start_date } = body

    if (!template_id || !week_start_date) {
      return NextResponse.json(
        { error: { message: 'Template ID and week start date are required' } },
        { status: 400 }
      )
    }

    // Get template with items
    const { data: template, error: templateError } = await supabase
      .from('shift_templates')
      .select(`
        id,
        organization_id,
        shift_template_items (
          id,
          day_of_week,
          start_time,
          end_time,
          user_id,
          position_id,
          notes,
          status
        )
      `)
      .eq('id', template_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: { message: 'Template not found' } },
        { status: 404 }
      )
    }

    // Verify template belongs to user's organization
    if (template.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Permission denied' } },
        { status: 403 }
      )
    }

    // Parse week start date
    const weekStart = new Date(week_start_date)
    weekStart.setHours(0, 0, 0, 0)

    // Calculate break time function (same as in frontend)
    const calculateBreakTime = (startTime: Date, endTime: Date): number => {
      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      if (durationHours > 9) return 45
      if (durationHours > 6) return 30
      return 0
    }

    // Create shifts from template items
    const shifts = template.shift_template_items.map((item: any) => {
      // Calculate the date for this day of week
      const shiftDate = new Date(weekStart)
      shiftDate.setDate(weekStart.getDate() + item.day_of_week)

      // Parse start and end times
      const [startHour, startMinute] = item.start_time.split(':').map(Number)
      const [endHour, endMinute] = item.end_time.split(':').map(Number)

      const startTime = new Date(shiftDate)
      startTime.setHours(startHour, startMinute, 0, 0)

      const endTime = new Date(shiftDate)
      endTime.setHours(endHour, endMinute, 0, 0)

      // Add break time if needed
      const breakTimeMinutes = calculateBreakTime(startTime, endTime)
      const adjustedEndTime = new Date(endTime.getTime() + breakTimeMinutes * 60 * 1000)

      return {
        organization_id: userData.organization_id,
        user_id: item.user_id || null,
        position_id: item.position_id || null,
        start_time: startTime.toISOString(),
        end_time: adjustedEndTime.toISOString(),
        position: null, // Legacy field
        notes: item.notes || null,
        status: item.status || 'scheduled',
        created_by: userData.id
      }
    })

    // Insert shifts
    const { data: createdShifts, error: shiftsError } = await supabase
      .from('shifts')
      .insert(shifts)
      .select()

    if (shiftsError) {
      console.error('Error creating shifts from template:', shiftsError)
      return NextResponse.json(
        { error: { message: 'Failed to create shifts from template' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      shifts: createdShifts,
      count: createdShifts?.length || 0
    })
  } catch (error: any) {
    console.error('Apply template API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

