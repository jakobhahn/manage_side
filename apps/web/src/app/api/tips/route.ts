import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Note: Tip extraction is now done when saving transactions to database
// This API route reads tip_amount directly from the database

// GET /api/tips - Get daily tips summary
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization_id
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '30') // Default to last 30 days
    const groupBy = searchParams.get('group_by') || 'day' // 'day' or 'month'

    // Build query - select all fields including tip_amount
    let query = supabase
      .from('payment_transactions')
      .select('id, transaction_date, tip_amount')
      .eq('organization_id', userData.organization_id)
      .gt('tip_amount', 0) // Only get transactions with tips
      .order('transaction_date', { ascending: false })

    // Add date filters if provided
    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }
    if (!startDate && !endDate) {
      // Default to last N days
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - limit)
      query = query.gte('transaction_date', dateLimit.toISOString().split('T')[0])
    }

    const { data: transactions, error: transactionsError } = await query

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError)
      return NextResponse.json(
        { error: { message: `Failed to fetch transactions: ${transactionsError.message || 'Unknown error'}` } },
        { status: 500 }
      )
    }

    // If no transactions found, return empty result
    if (!transactions || transactions.length === 0) {
      console.log('No transactions with tips found for organization:', userData.organization_id)
      return NextResponse.json({
        tips: [],
        totals: {
          totalTips: 0,
          totalTransactions: 0,
          averageTip: 0
        },
        debug: {
          message: 'No transactions with tips found in database',
          organization_id: userData.organization_id,
          dateRange: { start: startDate, end: endDate }
        }
      })
    }

    console.log(`Found ${transactions.length} transactions with tips in database`)

    // Group transactions by date and calculate tips
    const tipsByDate = new Map<string, any>()
    let tipFoundCount = 0

    transactions?.forEach((transaction) => {
      try {
        // Use tip_amount directly from database
        const tip = transaction.tip_amount || 0
        
        if (tip > 0) {
          tipFoundCount++
          // Handle both date strings and timestamps
          const transactionDate = transaction.transaction_date
          let dateStr: string
          if (transactionDate instanceof Date) {
            dateStr = transactionDate.toISOString().split('T')[0]
          } else if (typeof transactionDate === 'string') {
            dateStr = new Date(transactionDate).toISOString().split('T')[0]
          } else {
            console.warn('Invalid transaction_date format:', transactionDate)
            return
          }
          
          // Group by month or day
          let groupKey: string
          if (groupBy === 'month') {
            // Extract YYYY-MM from date
            groupKey = dateStr.substring(0, 7)
          } else {
            groupKey = dateStr
          }
          
          if (!tipsByDate.has(groupKey)) {
            if (groupBy === 'month') {
              const [year, month] = groupKey.split('-')
              const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1)
              const monthName = monthDate.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
              tipsByDate.set(groupKey, {
                date: groupKey,
                month: groupKey,
                monthName: monthName,
                totalTips: 0,
                transactionCount: 0,
                averageTip: 0
              })
            } else {
              tipsByDate.set(groupKey, {
                date: groupKey,
                totalTips: 0,
                transactionCount: 0
              })
            }
          }
          
          const dayData = tipsByDate.get(groupKey)!
          dayData.totalTips += tip
          dayData.transactionCount += 1
          
          // Calculate average for monthly grouping
          if (groupBy === 'month' && 'averageTip' in dayData) {
            dayData.averageTip = dayData.transactionCount > 0 ? dayData.totalTips / dayData.transactionCount : 0
          }
        }
      } catch (error) {
        console.error('Error processing transaction:', transaction.id, error)
      }
    })

    console.log(`Tips extraction summary: ${transactions.length} transactions with tips processed, ${tipFoundCount} grouped by date`)

    // Convert map to array and sort by date descending
    const tipsSummary = Array.from(tipsByDate.values())
      .sort((a, b) => {
        // Sort by month key (YYYY-MM) or date descending
        const keyA = groupBy === 'month' ? a.month : a.date
        const keyB = groupBy === 'month' ? b.month : b.date
        return keyB.localeCompare(keyA)
      })

    // Calculate totals
    const totalTips = tipsSummary.reduce((sum, day) => sum + day.totalTips, 0)
    const totalTransactions = tipsSummary.reduce((sum, day) => sum + day.transactionCount, 0)

    return NextResponse.json({
      tips: tipsSummary,
      totals: {
        totalTips,
        totalTransactions,
        averageTip: tipsSummary.length > 0 ? totalTips / tipsSummary.length : 0
      }
    })
  } catch (error: any) {
    console.error('Tips API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

