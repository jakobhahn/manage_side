import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Utility function to convert UTC date to Berlin timezone
function convertToBerlinTime(utcDate: Date): Date {
  // Berlin is UTC+1 in winter (CET) and UTC+2 in summer (CEST)
  // We'll use the Intl.DateTimeFormat to handle DST automatically
  const berlinTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "Europe/Berlin"}))
  return berlinTime
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { searchParams } = new URL(request.url)
    const analysisType = searchParams.get('type') || 'overview'

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user data to check role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission (owner or manager)
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    const organizationId = userData.organization_id

    // Get date range from query parameters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    let dateFilter = ''
    if (startDate && endDate) {
      // Format dates properly for Supabase queries
      const startDateFormatted = new Date(startDate).toISOString()
      const endDateFormatted = new Date(endDate + 'T23:59:59.999Z').toISOString()
      dateFilter = `${startDateFormatted}|${endDateFormatted}`
      console.log('📅 Analytics date filter:', { startDate, endDate, startDateFormatted, endDateFormatted })
    } else {
      console.log('📅 No date filter applied - using all data')
    }

    let analyticsData = {}

    switch (analysisType) {
      case 'weekdays':
        analyticsData = await getWeekdayAnalysis(supabase, organizationId, dateFilter)
        break
      case 'weekday-detail':
        const weekday = searchParams.get('weekday')
        analyticsData = await getWeekdayDetailAnalysis(supabase, organizationId, dateFilter, weekday)
        break
      case 'weeks':
        analyticsData = await getWeeklyAnalysis(supabase, organizationId, dateFilter)
        break
      case 'hours':
        analyticsData = await getHourlyAnalysis(supabase, organizationId, dateFilter)
        break
      case 'time-comparison':
        const period = searchParams.get('period') || 'weekly'
        analyticsData = await getTimeComparisonAnalysis(supabase, organizationId, dateFilter, period)
        break
      case 'meal-times':
        analyticsData = await getMealTimeAnalysis(supabase, organizationId, dateFilter)
        break
      case 'overview':
      default:
        analyticsData = await getOverviewAnalysis(supabase, organizationId, dateFilter)
        break
    }

    return NextResponse.json(analyticsData)

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

async function getWeekdayAnalysis(supabase: any, organizationId: string, dateFilter: string) {
  // Build query with date filter and pagination
  let allTransactions: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('payment_transactions')
      .select('amount, transaction_date')
      .eq('organization_id', organizationId)
      .eq('status', 'SUCCESSFUL')
      .order('transaction_date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    // Apply date filter if provided
    if (dateFilter) {
      const [startDate, endDate] = dateFilter.split('|')
      if (startDate) {
        query = query.gte('transaction_date', startDate)
      }
      if (endDate) {
        query = query.lt('transaction_date', endDate)
      }
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Weekday analysis error:', error)
      return { weekdays: [] }
    }

    if (!transactions || transactions.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...transactions]
      hasMore = transactions.length === pageSize
      page++
    }

    // Safety limit to prevent infinite loops
    if (page > 50) {
      console.warn('Reached safety limit of 50 pages')
      break
    }
  }

  console.log(`📊 Weekday analysis: Found ${allTransactions.length} total transactions with pagination`)

  const weekdays = [
    { name: 'Montag', day: 1, transactions: 0, revenue: 0, avgValue: 0 },
    { name: 'Dienstag', day: 2, transactions: 0, revenue: 0, avgValue: 0 },
    { name: 'Mittwoch', day: 3, transactions: 0, revenue: 0, avgValue: 0 },
    { name: 'Donnerstag', day: 4, transactions: 0, revenue: 0, avgValue: 0 },
    { name: 'Freitag', day: 5, transactions: 0, revenue: 0, avgValue: 0 },
    { name: 'Samstag', day: 6, transactions: 0, revenue: 0, avgValue: 0 },
    { name: 'Sonntag', day: 0, transactions: 0, revenue: 0, avgValue: 0 }
  ]

  // Process transactions by weekday
  if (allTransactions && allTransactions.length > 0) {
    // Group transactions by weekday
    const weekdayGroups: { [key: number]: { transactions: number[], dates: Set<string> } } = {}
    
    allTransactions.forEach((transaction: any) => {
      const utcDate = new Date(transaction.transaction_date)
      const berlinDate = convertToBerlinTime(utcDate)
      const dayOfWeek = berlinDate.getDay() // 0 = Sunday, 1 = Monday, etc.
      const amount = parseFloat(transaction.amount) || 0
      const dateKey = berlinDate.toISOString().split('T')[0] // YYYY-MM-DD

      if (!weekdayGroups[dayOfWeek]) {
        weekdayGroups[dayOfWeek] = { transactions: [], dates: new Set() }
      }
      
      weekdayGroups[dayOfWeek].transactions.push(amount)
      weekdayGroups[dayOfWeek].dates.add(dateKey)
    })

    // Calculate averages per weekday
    Object.keys(weekdayGroups).forEach(dayKey => {
      const dayIndex = parseInt(dayKey)
      const group = weekdayGroups[dayIndex]
      const totalRevenue = group.transactions.reduce((sum, amount) => sum + amount, 0)
      const totalTransactions = group.transactions.length
      const uniqueDays = group.dates.size

      // Find the correct weekday entry (dayIndex matches the day property)
      const weekdayEntry = weekdays.find(w => w.day === dayIndex)
      if (weekdayEntry) {
        weekdayEntry.transactions = totalTransactions
        weekdayEntry.revenue = totalRevenue / uniqueDays // Average revenue per day of this weekday
        weekdayEntry.avgValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
        
        console.log(`📊 ${weekdayEntry.name}: ${totalTransactions} transactions, ${uniqueDays} unique days, avg revenue: €${(totalRevenue / uniqueDays).toFixed(2)}`)
      }
    })
  }

  return { weekdays }
}

async function getWeekdayDetailAnalysis(supabase: any, organizationId: string, dateFilter: string, targetWeekday: string | null) {
  // Build query with date filter and pagination
  let allTransactions: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('payment_transactions')
      .select('amount, transaction_date')
      .eq('organization_id', organizationId)
      .eq('status', 'SUCCESSFUL')
      .order('transaction_date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    // Apply date filter if provided
    if (dateFilter) {
      const [startDate, endDate] = dateFilter.split('|')
      if (startDate) {
        query = query.gte('transaction_date', startDate)
      }
      if (endDate) {
        query = query.lt('transaction_date', endDate)
      }
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Weekday detail analysis error:', error)
      return { weekdayDetails: [] }
    }

    if (!transactions || transactions.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...transactions]
      hasMore = transactions.length === pageSize
      page++
    }

    // Safety limit to prevent infinite loops
    if (page > 50) {
      console.warn('Reached safety limit of 50 pages')
      break
    }
  }

  console.log(`📊 Weekday detail analysis: Found ${allTransactions.length} total transactions with pagination`)

  if (allTransactions.length === 0) {
    return { weekdayDetails: [] }
  }

  // Group transactions by date and weekday
  const dateGroups: { [key: string]: { transactions: number[], weekday: number, date: string } } = {}
  
  allTransactions.forEach((transaction: any) => {
    const utcDate = new Date(transaction.transaction_date)
    const berlinDate = convertToBerlinTime(utcDate)
    const dayOfWeek = berlinDate.getDay()
    const dateKey = berlinDate.toISOString().split('T')[0] // YYYY-MM-DD
    const amount = parseFloat(transaction.amount) || 0

    if (!dateGroups[dateKey]) {
      dateGroups[dateKey] = { transactions: [], weekday: dayOfWeek, date: dateKey }
    }
    
    dateGroups[dateKey].transactions.push(amount)
  })

  // Filter by target weekday if specified
  const targetWeekdayNum = targetWeekday ? parseInt(targetWeekday) : null
  const filteredDates = Object.values(dateGroups).filter(group => 
    targetWeekdayNum === null || group.weekday === targetWeekdayNum
  )

  // Convert to detail format
  const weekdayDetails = filteredDates.map(group => {
    const totalRevenue = group.transactions.reduce((sum, amount) => sum + amount, 0)
    const transactionCount = group.transactions.length
    const avgTransactionValue = transactionCount > 0 ? totalRevenue / transactionCount : 0
    
    const date = new Date(group.date)
    const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
    
    return {
      date: group.date,
      weekday: group.weekday,
      weekdayName: weekdayNames[group.weekday],
      revenue: totalRevenue,
      transactions: transactionCount,
      avgTransactionValue: avgTransactionValue,
      formattedDate: date.toLocaleDateString('de-DE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    }
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Calculate averages
  const totalRevenue = weekdayDetails.reduce((sum, day) => sum + day.revenue, 0)
  const totalTransactions = weekdayDetails.reduce((sum, day) => sum + day.transactions, 0)
  const avgRevenuePerDay = weekdayDetails.length > 0 ? totalRevenue / weekdayDetails.length : 0
  const avgTransactionsPerDay = weekdayDetails.length > 0 ? totalTransactions / weekdayDetails.length : 0
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  console.log(`📊 Weekday detail: ${weekdayDetails.length} days, avg revenue: €${avgRevenuePerDay.toFixed(2)}, avg transactions: ${avgTransactionsPerDay.toFixed(1)}`)

  return { 
    weekdayDetails,
    summary: {
      totalDays: weekdayDetails.length,
      totalRevenue,
      totalTransactions,
      avgRevenuePerDay,
      avgTransactionsPerDay,
      avgTransactionValue
    }
  }
}

async function getWeeklyAnalysis(supabase: any, organizationId: string, dateFilter: string) {
  // Build query with date filter and pagination
  let allTransactions: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('payment_transactions')
      .select('amount, transaction_date')
      .eq('organization_id', organizationId)
      .eq('status', 'SUCCESSFUL')
      .order('transaction_date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    // Apply date filter if provided
    if (dateFilter) {
      const [startDate, endDate] = dateFilter.split('|')
      if (startDate) {
        query = query.gte('transaction_date', startDate)
      }
      if (endDate) {
        query = query.lt('transaction_date', endDate)
      }
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Weekly analysis error:', error)
      return { weeks: [] }
    }

    if (!transactions || transactions.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...transactions]
      hasMore = transactions.length === pageSize
      page++
    }

    // Safety limit to prevent infinite loops
    if (page > 50) {
      console.warn('Reached safety limit of 50 pages')
      break
    }
  }

  console.log(`📊 Weekly analysis: Found ${allTransactions.length} total transactions with pagination`)
  console.log(`📅 Date filter for weeks: ${dateFilter}`)

  const weekMap = new Map<string, { transactions: number, revenue: number }>()

  // Process transactions by week
  if (allTransactions && allTransactions.length > 0) {
    allTransactions.forEach((transaction: any) => {
      const utcDate = new Date(transaction.transaction_date)
      const berlinDate = convertToBerlinTime(utcDate)
      const year = berlinDate.getFullYear()
      const weekNumber = getWeekNumber(berlinDate)
      const weekKey = `${year}-${weekNumber}`
      const amount = parseFloat(transaction.amount) || 0

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { transactions: 0, revenue: 0 })
      }

      const weekData = weekMap.get(weekKey)!
      weekData.transactions++
      weekData.revenue += amount
    })
  }

  // Generate all weeks in the date range, even if they have no transactions
  const allWeeks: { [key: string]: { transactions: number, revenue: number } } = {}
  
  // If we have a date filter, generate all weeks in that range
  if (dateFilter) {
    const [startDate, endDate] = dateFilter.split('|')
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      // Start from the Monday of the week containing the start date
      const startMonday = new Date(start)
      const startDayOfWeek = start.getDay()
      const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1 // Sunday = 0, so 6 days to Monday
      startMonday.setDate(start.getDate() - daysToMonday)
      
      // Generate all weeks from start to end
      const currentWeek = new Date(startMonday)
      let weekCount = 0
      while (currentWeek <= end && weekCount < 100) { // Safety limit
        const year = currentWeek.getFullYear()
        const weekNumber = getWeekNumber(currentWeek)
        const weekKey = `${year}-${weekNumber}`
        
        if (!allWeeks[weekKey]) {
          allWeeks[weekKey] = { transactions: 0, revenue: 0 }
        }
        
        // Move to next week (add 7 days)
        currentWeek.setDate(currentWeek.getDate() + 7)
        weekCount++
      }
      
      // Also generate weeks that might be missing due to end date
      const endMonday = new Date(end)
      const endDayOfWeek = end.getDay()
      const daysToEndMonday = endDayOfWeek === 0 ? 6 : endDayOfWeek - 1
      endMonday.setDate(end.getDate() - daysToEndMonday)
      
      // Add the end week if it's not already included
      const endYear = endMonday.getFullYear()
      const endWeekNumber = getWeekNumber(endMonday)
      const endWeekKey = `${endYear}-${endWeekNumber}`
      
      if (!allWeeks[endWeekKey]) {
        allWeeks[endWeekKey] = { transactions: 0, revenue: 0 }
      }
    }
  }
  
  // Merge with actual transaction data
  weekMap.forEach((weekData, weekKey) => {
    allWeeks[weekKey] = weekData
  })

  // Convert to array format
  const weeks = Array.from(Object.entries(allWeeks)).map(([weekKey, data]) => {
    const [year, weekNumber] = weekKey.split('-')
    return {
      week: parseInt(weekNumber),
      year: parseInt(year),
      label: `KW ${weekNumber}`,
      transactions: data.transactions,
      revenue: data.revenue,
      avgValue: data.transactions > 0 ? data.revenue / data.transactions : 0
    }
  }).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.week - b.week
  })

  console.log(`📊 Generated ${weeks.length} weeks total`)
  console.log(`📊 Week range: KW ${weeks[0]?.week || 'N/A'} to KW ${weeks[weeks.length - 1]?.week || 'N/A'}`)

  return { weeks }
}

// Helper function to get week number (ISO 8601: Monday is first day of week)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7 // Convert Sunday (0) to 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // Get to Monday of the week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

async function getHourlyAnalysis(supabase: any, organizationId: string, dateFilter: string) {
  // Build query with date filter and pagination
  let allTransactions: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('payment_transactions')
      .select('amount, transaction_date')
      .eq('organization_id', organizationId)
      .eq('status', 'SUCCESSFUL')
      .order('transaction_date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    // Apply date filter if provided
    if (dateFilter) {
      const [startDate, endDate] = dateFilter.split('|')
      if (startDate) {
        query = query.gte('transaction_date', startDate)
      }
      if (endDate) {
        query = query.lt('transaction_date', endDate)
      }
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Hourly analysis error:', error)
      return { hours: [] }
    }

    if (!transactions || transactions.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...transactions]
      hasMore = transactions.length === pageSize
      page++
    }

    // Safety limit to prevent infinite loops
    if (page > 50) {
      console.warn('Reached safety limit of 50 pages')
      break
    }
  }

  console.log(`📊 Hourly analysis: Found ${allTransactions.length} total transactions with pagination`)

  // Create array for all 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, '0')}:00`,
    transactions: 0,
    revenue: 0,
    avgValue: 0
  }))

  // Process transactions by hour
  if (allTransactions && allTransactions.length > 0) {
    allTransactions.forEach((transaction: any) => {
      const utcDate = new Date(transaction.transaction_date)
      const berlinDate = convertToBerlinTime(utcDate)
      const hour = berlinDate.getHours()
      const amount = parseFloat(transaction.amount) || 0

      hours[hour].transactions++
      hours[hour].revenue += amount
    })

    // Calculate average values
    hours.forEach(hour => {
      if (hour.transactions > 0) {
        hour.avgValue = hour.revenue / hour.transactions
      }
    })
  }

  return { hours }
}

async function getOverviewAnalysis(supabase: any, organizationId: string, dateFilter: string) {
  // Get all three analyses for overview
  const [weekdays, weeks, hours] = await Promise.all([
    getWeekdayAnalysis(supabase, organizationId, dateFilter),
    getWeeklyAnalysis(supabase, organizationId, dateFilter),
    getHourlyAnalysis(supabase, organizationId, dateFilter)
  ])

  console.log('📊 Overview analysis results:')
  console.log('📊 Weekdays:', weekdays.weekdays?.length || 0, 'items')
  console.log('📊 Weeks:', weeks.weeks?.length || 0, 'items')
  console.log('📊 Hours:', hours.hours?.length || 0, 'items')

  return {
    weekdays: weekdays.weekdays,
    weeks: weeks.weeks,
    hours: hours.hours
  }
}

async function getTimeComparisonAnalysis(supabase: any, organizationId: string, dateFilter: string, period: string) {
  // Build query with date filter and pagination
  let allTransactions: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('payment_transactions')
      .select('amount, transaction_date')
      .eq('organization_id', organizationId)
      .eq('status', 'SUCCESSFUL')
      .order('transaction_date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    // Apply date filter if provided
    if (dateFilter) {
      const [startDate, endDate] = dateFilter.split('|')
      if (startDate) {
        query = query.gte('transaction_date', startDate)
      }
      if (endDate) {
        query = query.lt('transaction_date', endDate)
      }
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Time comparison analysis error:', error)
      return { periods: [] }
    }

    if (!transactions || transactions.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...transactions]
      hasMore = transactions.length === pageSize
      page++
    }

    // Safety limit to prevent infinite loops
    if (page > 50) {
      console.warn('Reached safety limit of 50 pages')
      break
    }
  }

  console.log(`📊 Time comparison analysis: Found ${allTransactions.length} total transactions with pagination`)

  const periodMap = new Map<string, { [hour: number]: { transactions: number, revenue: number } }>()

  // Process transactions by period and hour
  if (allTransactions && allTransactions.length > 0) {
    allTransactions.forEach((transaction: any) => {
      const utcDate = new Date(transaction.transaction_date)
      const berlinDate = convertToBerlinTime(utcDate)
      const hour = berlinDate.getHours()
      const amount = parseFloat(transaction.amount) || 0

      let periodKey: string
      if (period === 'weekly') {
        const year = berlinDate.getFullYear()
        const weekNumber = getWeekNumber(berlinDate)
        periodKey = `${year}-KW${weekNumber}`
      } else { // monthly
        const year = berlinDate.getFullYear()
        const month = berlinDate.getMonth() + 1
        periodKey = `${year}-${month.toString().padStart(2, '0')}`
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {})
      }

      const periodData = periodMap.get(periodKey)!
      if (!periodData[hour]) {
        periodData[hour] = { transactions: 0, revenue: 0 }
      }

      periodData[hour].transactions++
      periodData[hour].revenue += amount
    })
  }

  // Convert to array format
  const periods = Array.from(periodMap.entries()).map(([periodKey, hourData]) => {
    const hours = Array.from({ length: 24 }, (_, hour) => {
      const data = hourData[hour] || { transactions: 0, revenue: 0 }
      return {
        hour,
        transactions: data.transactions,
        revenue: data.revenue,
        avgValue: data.transactions > 0 ? data.revenue / data.transactions : 0
      }
    })

    return {
      period: periodKey,
      hours
    }
  }).sort((a, b) => a.period.localeCompare(b.period))

  console.log(`📊 Generated ${periods.length} periods for time comparison`)

  return { periods }
}

async function getMealTimeAnalysis(supabase: any, organizationId: string, dateFilter: string) {
  // Build query with date filter and pagination
  let allTransactions: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('payment_transactions')
      .select('amount, transaction_date')
      .eq('organization_id', organizationId)
      .eq('status', 'SUCCESSFUL')
      .order('transaction_date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    // Apply date filter if provided
    if (dateFilter) {
      const [startDate, endDate] = dateFilter.split('|')
      if (startDate) {
        query = query.gte('transaction_date', startDate)
      }
      if (endDate) {
        query = query.lt('transaction_date', endDate)
      }
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Meal time analysis error:', error)
      return { mealTimes: [] }
    }

    if (!transactions || transactions.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...transactions]
      hasMore = transactions.length === pageSize
      page++
    }

    // Safety limit to prevent infinite loops
    if (page > 50) {
      console.warn('Reached safety limit of 50 pages')
      break
    }
  }

  console.log(`📊 Meal time analysis: Found ${allTransactions.length} total transactions with pagination`)

  // Define meal time periods
  const mealPeriods = {
    lunch: { name: 'Mittagszeit', start: 12, end: 14.5, transactions: 0, revenue: 0, days: new Set() },
    dinner: { name: 'Abendzeit', start: 17, end: 23.99, transactions: 0, revenue: 0, days: new Set() }
  }

  // Process transactions by meal time
  if (allTransactions && allTransactions.length > 0) {
    allTransactions.forEach((transaction: any) => {
      const utcDate = new Date(transaction.transaction_date)
      const berlinDate = convertToBerlinTime(utcDate)
      const hour = berlinDate.getHours() + (berlinDate.getMinutes() / 60) // Include minutes for 14:30 cutoff
      const amount = parseFloat(transaction.amount) || 0
      const dateKey = berlinDate.toISOString().split('T')[0]

      // Check if transaction falls in lunch time (12:00 - 14:30)
      if (hour >= mealPeriods.lunch.start && hour <= mealPeriods.lunch.end) {
        mealPeriods.lunch.transactions++
        mealPeriods.lunch.revenue += amount
        mealPeriods.lunch.days.add(dateKey)
      }
      
      // Check if transaction falls in dinner time (17:00 - 23:59)
      if (hour >= mealPeriods.dinner.start && hour <= mealPeriods.dinner.end) {
        mealPeriods.dinner.transactions++
        mealPeriods.dinner.revenue += amount
        mealPeriods.dinner.days.add(dateKey)
      }
    })
  }

  // Calculate averages and format results
  const mealTimes = Object.entries(mealPeriods).map(([key, data]) => {
    const uniqueDays = data.days.size
    const avgRevenuePerDay = uniqueDays > 0 ? data.revenue / uniqueDays : 0
    const avgTransactionsPerDay = uniqueDays > 0 ? data.transactions / uniqueDays : 0
    const avgTransactionValue = data.transactions > 0 ? data.revenue / data.transactions : 0

    return {
      period: key,
      name: data.name,
      timeRange: key === 'lunch' ? '12:00 - 14:30' : '17:00 - 23:59',
      totalTransactions: data.transactions,
      totalRevenue: data.revenue,
      uniqueDays: uniqueDays,
      avgRevenuePerDay: avgRevenuePerDay,
      avgTransactionsPerDay: avgTransactionsPerDay,
      avgTransactionValue: avgTransactionValue
    }
  })

  // Calculate comparison metrics
  const lunchData = mealTimes.find(m => m.period === 'lunch')
  const dinnerData = mealTimes.find(m => m.period === 'dinner')
  
  const comparison = {
    revenueRatio: dinnerData && lunchData && lunchData.totalRevenue > 0 
      ? dinnerData.totalRevenue / lunchData.totalRevenue 
      : 0,
    transactionRatio: dinnerData && lunchData && lunchData.totalTransactions > 0 
      ? dinnerData.totalTransactions / lunchData.totalTransactions 
      : 0,
    strongerPeriod: dinnerData && lunchData 
      ? (dinnerData.totalRevenue > lunchData.totalRevenue ? 'dinner' : 'lunch')
      : null
  }

  console.log(`📊 Meal time analysis completed:`)
  console.log(`📊 Lunch: ${lunchData?.totalTransactions} transactions, €${lunchData?.totalRevenue.toFixed(2)}`)
  console.log(`📊 Dinner: ${dinnerData?.totalTransactions} transactions, €${dinnerData?.totalRevenue.toFixed(2)}`)

  return { 
    mealTimes,
    comparison,
    summary: {
      totalPeriods: 2,
      totalTransactions: mealTimes.reduce((sum, m) => sum + m.totalTransactions, 0),
      totalRevenue: mealTimes.reduce((sum, m) => sum + m.totalRevenue, 0)
    }
  }
}
