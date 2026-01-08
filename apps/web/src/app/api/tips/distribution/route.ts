import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface DayDistribution {
  date: string
  totalTips: number
  totalHours: number
  employees: Array<{
    userId: string
    userName: string
    hours: number
    tipShare: number
    tipSharePercent: number
  }>
}

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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: { message: 'start_date and end_date are required' } }, { status: 400 })
    }

    // Fetch approved time clock entries
    const { data: timeEntries, error: timeEntriesError } = await supabase
      .from('time_clock_entries')
      .select(`
        id,
        user_id,
        clock_in,
        clock_out,
        is_approved,
        user:user_id(id, name)
      `)
      .eq('organization_id', userData.organization_id)
      .eq('is_approved', true)
      .gte('clock_in', startDate)
      .lte('clock_in', `${endDate}T23:59:59`)
      .not('clock_out', 'is', null)

    if (timeEntriesError) {
      console.error('Failed to fetch time entries:', timeEntriesError)
      return NextResponse.json({ error: { message: 'Failed to fetch time entries' } }, { status: 500 })
    }

    // Fetch breaks for all time entries
    const entryIds = timeEntries?.map(e => e.id) || []
    const { data: breaks, error: breaksError } = entryIds.length > 0 ? await supabase
      .from('time_clock_breaks')
      .select('id, time_clock_entry_id, break_start, break_end')
      .in('time_clock_entry_id', entryIds)
      .not('break_end', 'is', null) : { data: [], error: null }

    if (breaksError) {
      console.warn('Failed to fetch breaks:', breaksError)
      // Continue without breaks - not critical
    }

    // Map breaks by entry ID
    const breaksByEntryId = new Map<string, Array<{ break_start: string, break_end: string }>>()
    breaks?.forEach((breakEntry) => {
      if (!breaksByEntryId.has(breakEntry.time_clock_entry_id)) {
        breaksByEntryId.set(breakEntry.time_clock_entry_id, [])
      }
      breaksByEntryId.get(breakEntry.time_clock_entry_id)!.push({
        break_start: breakEntry.break_start,
        break_end: breakEntry.break_end
      })
    })

    // Fetch tips for the date range
    const { data: transactions, error: transactionsError } = await supabase
      .from('payment_transactions')
      .select('transaction_date, tip_amount')
      .eq('organization_id', userData.organization_id)
      .gte('transaction_date', startDate)
      .lte('transaction_date', `${endDate}T23:59:59`)
      .gt('tip_amount', 0)

    if (transactionsError) {
      console.error('Failed to fetch transactions:', transactionsError)
      return NextResponse.json({ error: { message: 'Failed to fetch transactions' } }, { status: 500 })
    }

    // Group time entries by date and user
    const entriesByDate = new Map<string, Map<string, { hours: number, userName: string }>>()
    
    timeEntries?.forEach((entry) => {
      if (!entry.clock_out || !entry.user) return
      
      const clockIn = new Date(entry.clock_in)
      const clockOut = new Date(entry.clock_out)
      const dateStr = clockIn.toISOString().split('T')[0]
      
      // Calculate total hours worked
      let totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
      
      // Subtract break time if breaks exist
      const entryBreaks = breaksByEntryId.get(entry.id) || []
      let breakHours = 0
      entryBreaks.forEach((breakEntry) => {
        if (breakEntry.break_start && breakEntry.break_end) {
          const breakStart = new Date(breakEntry.break_start)
          const breakEnd = new Date(breakEntry.break_end)
          breakHours += (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60)
        }
      })
      
      // Subtract break hours from total hours
      totalHours = Math.max(0, totalHours - breakHours)
      
      // Debug logging
      if (totalHours > 0) {
        console.log(`[Tips Distribution] Entry ${entry.id}: User ${(entry.user as any).name}, Date ${dateStr}, Hours: ${totalHours.toFixed(2)}, Break Hours: ${breakHours.toFixed(2)}`)
      }
      
      if (!entriesByDate.has(dateStr)) {
        entriesByDate.set(dateStr, new Map())
      }
      
      const dateMap = entriesByDate.get(dateStr)!
      const userId = entry.user_id
      const userName = (entry.user as any).name || 'Unknown'
      
      if (dateMap.has(userId)) {
        dateMap.get(userId)!.hours += totalHours
      } else {
        dateMap.set(userId, { hours: totalHours, userName })
      }
    })

    // Group tips by date
    const tipsByDate = new Map<string, number>()
    
    transactions?.forEach((transaction) => {
      const transactionDate = transaction.transaction_date
      let dateStr: string
      
      if (transactionDate instanceof Date) {
        dateStr = transactionDate.toISOString().split('T')[0]
      } else if (typeof transactionDate === 'string') {
        dateStr = new Date(transactionDate).toISOString().split('T')[0]
      } else {
        return
      }
      
      const tip = transaction.tip_amount || 0
      tipsByDate.set(dateStr, (tipsByDate.get(dateStr) || 0) + tip)
    })

    // Calculate distribution for each day
    const distribution: DayDistribution[] = []
    
    // Get all unique dates
    const allDates = new Set<string>()
    entriesByDate.forEach((_, date) => allDates.add(date))
    tipsByDate.forEach((_, date) => allDates.add(date))
    
    Array.from(allDates).sort().reverse().forEach((dateStr) => {
      const employeeHours = entriesByDate.get(dateStr) || new Map()
      const totalTips = tipsByDate.get(dateStr) || 0
      
      if (employeeHours.size === 0 && totalTips === 0) {
        return // Skip days with no data
      }
      
      // Calculate total hours for the day
      let totalHours = 0
      employeeHours.forEach((data) => {
        totalHours += data.hours
      })
      
      // Debug logging
      console.log(`[Tips Distribution] Date ${dateStr}: Total Hours: ${totalHours.toFixed(2)}, Total Tips: ${totalTips.toFixed(2)}, Employees: ${employeeHours.size}`)
      employeeHours.forEach((data, userId) => {
        console.log(`  - User ${data.userName}: ${data.hours.toFixed(2)} hours`)
      })
      if (totalTips > 0 && employeeHours.size > 0) {
        const equalShare = totalTips / employeeHours.size
        console.log(`  - Equal share per employee: ${equalShare.toFixed(2)}`)
      }
      
      // Calculate tip distribution per employee
      // ALWAYS distribute equally among all employees who worked that day, regardless of hours
      const employees: DayDistribution['employees'] = []
      
      if (totalTips > 0 && employeeHours.size > 0) {
        // Equal distribution: everyone who worked gets the same share
        const equalShare = totalTips / employeeHours.size
        const equalSharePercent = 100 / employeeHours.size
        
        employeeHours.forEach((data, userId) => {
          employees.push({
            userId,
            userName: data.userName,
            hours: data.hours,
            tipShare: equalShare,
            tipSharePercent: equalSharePercent
          })
        })
      } else if (employeeHours.size > 0) {
        // Hours but no tips
        employeeHours.forEach((data, userId) => {
          employees.push({
            userId,
            userName: data.userName,
            hours: data.hours,
            tipShare: 0,
            tipSharePercent: 0
          })
        })
      }
      
      distribution.push({
        date: dateStr,
        totalTips,
        totalHours,
        employees: employees.sort((a, b) => b.hours - a.hours) // Sort by hours descending
      })
    })

    // Calculate per-employee summary for the month
    const employeeSummary = new Map<string, {
      userId: string
      userName: string
      totalTips: number
      totalHours: number
      daysWorked: number
    }>()

    distribution.forEach((day) => {
      day.employees.forEach((emp) => {
        if (!employeeSummary.has(emp.userId)) {
          employeeSummary.set(emp.userId, {
            userId: emp.userId,
            userName: emp.userName,
            totalTips: 0,
            totalHours: 0,
            daysWorked: 0
          })
        }
        const summary = employeeSummary.get(emp.userId)!
        summary.totalTips += emp.tipShare
        summary.totalHours += emp.hours
        summary.daysWorked += 1
      })
    })

    // Convert to array and sort by total tips descending
    const employeeSummaryArray = Array.from(employeeSummary.values())
      .sort((a, b) => b.totalTips - a.totalTips)

    return NextResponse.json({
      distribution,
      summary: {
        totalDays: distribution.length,
        totalTips: distribution.reduce((sum, day) => sum + day.totalTips, 0),
        totalHours: distribution.reduce((sum, day) => sum + day.totalHours, 0)
      },
      employeeSummary: employeeSummaryArray
    })
  } catch (error: any) {
    console.error('Tips distribution API error:', error)
    return NextResponse.json(
      { error: { message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

