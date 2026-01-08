import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Create Supabase client with service role key for admin operations
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
      console.error('Permission denied for user:', user.id, 'Role:', userData.role)
      return NextResponse.json(
        { error: { message: `Insufficient permissions. User role: ${userData.role}. Required: owner or manager` } },
        { status: 403 }
      )
    }

    // Fetch payment transactions for the organization (with pagination to get all)
    let allTransactions: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: transactions, error: transactionsError } = await supabase
        .from('payment_transactions')
        .select('id, transaction_date, amount, tip_amount, vat_amount, transaction_id, status, currency, raw_data, vat_7, vat_19')
        .eq('organization_id', userData.organization_id)
        .not('status', 'eq', 'FAILED') // Exclude FAILED transactions
        .not('status', 'eq', 'CANCELLED') // Exclude CANCELLED transactions
        .order('transaction_date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (transactionsError) {
        console.error('Revenue fetch error:', transactionsError)
        return NextResponse.json(
          { error: { message: `Failed to fetch revenue data: ${transactionsError.message || transactionsError}` } },
          { status: 500 }
        )
      }

      if (!transactions || transactions.length === 0) {
        hasMore = false
      } else {
        allTransactions = [...allTransactions, ...transactions]
        hasMore = transactions.length === pageSize
        page++
      }

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('Reached pagination safety limit (100 pages)')
        break
      }
    }

    const transactions = allTransactions

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        today: {
          revenue: 0,
          netto: 0,
          vat: 0,
          tips: 0,
          transaction_count: 0
        },
        weekly: [],
        monthly: [],
        transactions: [],
        today_items: [],
        weekly_items: [],
        monthly_items: []
      })
    }

    // Get selected date from query parameter, default to today
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    let selectedDate: Date
    if (dateParam) {
      selectedDate = new Date(dateParam)
      // Validate date
      if (isNaN(selectedDate.getTime())) {
        return NextResponse.json(
          { error: { message: 'Invalid date parameter' } },
          { status: 400 }
        )
      }
    } else {
      selectedDate = new Date()
    }
    
    // Set to start of day in local timezone
    const selectedDateStr = selectedDate.toISOString().split('T')[0]

    // Calculate selected day's stats
    let todayRevenue = 0
    let todayNetto = 0
    let todayVat = 0
    let todayVat7 = 0  // MwSt 7%
    let todayVat19 = 0 // MwSt 19%
    let todayTips = 0
    let todayTransactionCount = 0

    // Group transactions by week and month
    const weeklyData = new Map<string, {
      week_start: string
      revenue: number
      netto: number
      transaction_count: number
    }>()

    const monthlyData = new Map<string, {
      month_start: string
      revenue: number
      netto: number
      vat: number
      vat_7: number  // MwSt 7%
      vat_19: number // MwSt 19%
      tips: number
      transaction_count: number
    }>()

    transactions.forEach((transaction) => {
      // Skip failed and cancelled transactions (additional safety check)
      if (transaction.status === 'FAILED' || transaction.status === 'CANCELLED') {
        return
      }
      
      const transactionDate = transaction.transaction_date
      let date: Date
      
      if (transactionDate instanceof Date) {
        date = transactionDate
      } else if (typeof transactionDate === 'string') {
        date = new Date(transactionDate)
      } else {
        return
      }

      const dateStr = date.toISOString().split('T')[0]
      const amount = transaction.amount || 0
      const vat = transaction.vat_amount || 0
      const tip = transaction.tip_amount || 0
      const netto = amount - vat - tip

      // Get VAT breakdown directly from transaction (if available from SumUp)
      // Otherwise, calculate from transaction_items
      let vat7 = transaction.vat_7 || 0
      let vat19 = transaction.vat_19 || 0

      // Selected day's stats
      if (dateStr === selectedDateStr) {
        todayRevenue += amount
        todayNetto += netto
        todayVat += vat
        todayVat7 += vat7
        todayVat19 += vat19
        todayTips += tip
        todayTransactionCount += 1
      }

      // Weekly grouping
      const monday = new Date(date)
      const dayOfWeek = monday.getDay()
      const diff = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      monday.setDate(diff)
      const weekKey = monday.toISOString().split('T')[0]

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          week_start: weekKey,
          revenue: 0,
          netto: 0,
          transaction_count: 0
        })
      }
      const weekData = weeklyData.get(weekKey)!
      weekData.revenue += amount
      weekData.netto += netto
      weekData.transaction_count += 1

      // Monthly grouping
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month_start: monthKey,
          revenue: 0,
          netto: 0,
          vat: 0,
          vat_7: 0,
          vat_19: 0,
          tips: 0,
          transaction_count: 0
        })
      }
      const monthData = monthlyData.get(monthKey)!
      monthData.revenue += amount
      monthData.netto += netto
      monthData.vat += vat
      monthData.vat_7 += vat7
      monthData.vat_19 += vat19
      monthData.tips += tip
      monthData.transaction_count += 1
    })

    // Convert to arrays and sort (no limit - show all data)
    const weeklyArray = Array.from(weeklyData.values())
      .sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime())

    const monthlyArray = Array.from(monthlyData.values())
      .sort((a, b) => new Date(b.month_start).getTime() - new Date(a.month_start).getTime())

    // Format transactions for display
    const formattedTransactions = transactions.map(t => {
      const amount = t.amount || 0
      const vat = t.vat_amount || 0
      const tip = t.tip_amount || 0
      const netto = amount - vat - tip
      
      // Try to extract transaction_code from raw_data if available
      let transactionCode = t.transaction_id || null
      if (t.raw_data && typeof t.raw_data === 'object') {
        transactionCode = (t.raw_data as any).transaction_code || 
                         (t.raw_data as any).transactionCode ||
                         transactionCode
      }
      
      return {
        id: t.id,
        transaction_date: t.transaction_date,
        transaction_code: transactionCode,
        amount: amount,
        netto: netto,
        vat_amount: vat,
        tip_amount: tip,
        status: t.status || null,
        currency: t.currency || 'EUR'
      }
    })

    // Fetch transaction items for sold products with product VAT rates
    // First get all transaction items for the organization with their transaction dates
    // Exclude items from FAILED or CANCELLED transactions
    const { data: transactionItems, error: itemsError } = await supabase
      .from('transaction_items')
      .select(`
        id,
        transaction_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        created_at,
        payment_transactions (
          id,
          transaction_date,
          organization_id,
          status
        ),
        products (
          id,
          vat_rate
        )
      `)
      .eq('organization_id', userData.organization_id)

    if (itemsError) {
      console.error('Transaction items fetch error:', itemsError)
      // Continue without items data rather than failing
    } else {
      console.log(`Found ${transactionItems?.length || 0} transaction items`)
    }

    // Aggregate sold items by day, week, and month
    const todayItems = new Map<string, { name: string; quantity: number; revenue: number; product_id: string | null }>()
    const weeklyItems = new Map<string, Map<string, { name: string; quantity: number; revenue: number; product_id: string | null }>>()
    const monthlyItems = new Map<string, Map<string, { name: string; quantity: number; revenue: number; product_id: string | null }>>()

    // Create a map to track netto amounts by VAT rate per transaction
    // We'll use this to proportionally split the actual vat_amount from the transaction
    // ONLY if vat_7 and vat_19 are not already set in the transaction
    const transactionNettoMap = new Map<string, { netto7: number; netto19: number; totalVat: number }>()
    
    // First pass: Calculate netto amounts by VAT rate for each transaction
    // Only if vat_7 and vat_19 are not already set
    if (transactionItems && transactionItems.length > 0) {
      transactionItems.forEach((item: any) => {
        // Handle both single transaction object and array
        const transaction = Array.isArray(item.payment_transactions) 
          ? item.payment_transactions[0] 
          : item.payment_transactions
          
        if (!transaction || !transaction.transaction_date) {
          console.warn('Transaction item missing transaction date:', item.id)
          return
        }
        
        // Skip items from FAILED or CANCELLED transactions
        if (transaction.status === 'FAILED' || transaction.status === 'CANCELLED') {
          return
        }

        const transactionDate = new Date(transaction.transaction_date)
        const dateStr = transactionDate.toISOString().split('T')[0]
        const productKey = item.product_id || item.product_name
        const quantity = parseFloat(item.quantity) || 0
        const revenue = parseFloat(item.total_price) || 0
        
        // Get product VAT rate from products table
        const product = Array.isArray(item.products) ? item.products[0] : item.products
        const vatRate = product?.vat_rate || 19.0 // Default to 19% if not found
        
        // Calculate netto for this item
        // total_price is brutto (including VAT), so: netto = brutto / (1 + vat_rate/100)
        const itemNetto = revenue / (1 + vatRate / 100)
        
        // Track netto by transaction ID and VAT rate
        const txId = transaction.id
        if (!transactionNettoMap.has(txId)) {
          // We'll get the total VAT from the transaction later
          transactionNettoMap.set(txId, { netto7: 0, netto19: 0, totalVat: 0 })
        }
        const txNetto = transactionNettoMap.get(txId)!
        if (Math.abs(vatRate - 7.0) < 1.0) {
          // 7% VAT (with 1% tolerance)
          txNetto.netto7 += itemNetto
        } else {
          // 19% VAT (default)
          txNetto.netto19 += itemNetto
        }

        // Today's items
        if (dateStr === selectedDateStr) {
          if (!todayItems.has(productKey)) {
            todayItems.set(productKey, {
              name: item.product_name,
              quantity: 0,
              revenue: 0,
              product_id: item.product_id
            })
          }
          const todayItem = todayItems.get(productKey)!
          todayItem.quantity += quantity
          todayItem.revenue += revenue
        }

        // Weekly grouping
        const monday = new Date(transactionDate)
        const dayOfWeek = monday.getDay()
        const diff = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        monday.setDate(diff)
        const weekKey = monday.toISOString().split('T')[0]

        if (!weeklyItems.has(weekKey)) {
          weeklyItems.set(weekKey, new Map())
        }
        const weekItems = weeklyItems.get(weekKey)!
        if (!weekItems.has(productKey)) {
          weekItems.set(productKey, {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
            product_id: item.product_id
          })
        }
        const weekItem = weekItems.get(productKey)!
        weekItem.quantity += quantity
        weekItem.revenue += revenue

        // Monthly grouping
        const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}-01`
        if (!monthlyItems.has(monthKey)) {
          monthlyItems.set(monthKey, new Map())
        }
        const monthItems = monthlyItems.get(monthKey)!
        if (!monthItems.has(productKey)) {
          monthItems.set(productKey, {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
            product_id: item.product_id
          })
        }
        const monthItem = monthItems.get(productKey)!
        monthItem.quantity += quantity
        monthItem.revenue += revenue
      })
    }
    
    // Second pass: Use vat_7 and vat_19 from transactions if available, otherwise calculate proportionally
    transactions.forEach((transaction) => {
      if (transaction.status === 'FAILED' || transaction.status === 'CANCELLED') {
        return
      }
      
      const transactionDate = transaction.transaction_date
      let date: Date
      
      if (transactionDate instanceof Date) {
        date = transactionDate
      } else if (typeof transactionDate === 'string') {
        date = new Date(transactionDate)
      } else {
        return
      }

      const dateStr = date.toISOString().split('T')[0]
      
      // Use vat_7 and vat_19 directly from transaction if available (from SumUp)
      let vat7 = transaction.vat_7 || 0
      let vat19 = transaction.vat_19 || 0
      
      // If not available, calculate proportionally from transaction_items
      if (vat7 === 0 && vat19 === 0) {
        const txNetto = transactionNettoMap.get(transaction.id)
        if (txNetto) {
          const totalVat = transaction.vat_amount || 0
          const totalNetto = txNetto.netto7 + txNetto.netto19
          
          if (totalNetto > 0 && totalVat > 0) {
            // Proportional split: vat7 = totalVat * (netto7 / totalNetto)
            vat7 = totalVat * (txNetto.netto7 / totalNetto)
            vat19 = totalVat * (txNetto.netto19 / totalNetto)
          } else if (txNetto.netto7 > 0) {
            // Only 7% items
            vat7 = totalVat
          } else if (txNetto.netto19 > 0) {
            // Only 19% items
            vat19 = totalVat
          }
        }
      }
      
      // Update today's VAT split
      if (dateStr === selectedDateStr) {
        todayVat7 += vat7
        todayVat19 += vat19
      }
      
      // Update monthly VAT split
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
      const monthData = monthlyData.get(monthKey)
      if (monthData) {
        monthData.vat_7 += vat7
        monthData.vat_19 += vat19
      }
    })

    // Convert maps to arrays
    const todayItemsArray = Array.from(todayItems.values())
      .sort((a, b) => b.revenue - a.revenue)

    const weeklyItemsArray = Array.from(weeklyItems.entries()).map(([weekKey, items]) => ({
      week_start: weekKey,
      items: Array.from(items.values()).sort((a, b) => b.revenue - a.revenue)
    }))

    const monthlyItemsArray = Array.from(monthlyItems.entries()).map(([monthKey, items]) => ({
      month_start: monthKey,
      items: Array.from(items.values()).sort((a, b) => b.revenue - a.revenue)
    }))

    return NextResponse.json({
      today: {
        revenue: todayRevenue,
        netto: todayNetto,
        vat: todayVat,
        vat_7: todayVat7,
        vat_19: todayVat19,
        tips: todayTips,
        transaction_count: todayTransactionCount
      },
      weekly: weeklyArray,
      monthly: monthlyArray,
      transactions: formattedTransactions,
      today_items: todayItemsArray,
      weekly_items: weeklyItemsArray,
      monthly_items: monthlyItemsArray
    })
  } catch (error: any) {
    console.error('Revenue fetch error:', error)
    return NextResponse.json(
      { error: { message: `Internal server error: ${error?.message || error}` } },
      { status: 500 }
    )
  }
}
