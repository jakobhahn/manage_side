import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/transaction-items/unlinked - Get all transaction items without a linked product
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: { message: 'Authorization token required' } }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: { message: 'Invalid token' } }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    // Get all transaction items without a product_id, grouped by product_name
    const { data: unlinkedItems, error } = await supabase
      .from('transaction_items')
      .select(`
        id,
        product_name,
        unit_price,
        total_price,
        quantity,
        created_at,
        payment_transactions (
          id,
          transaction_date,
          status
        )
      `)
      .eq('organization_id', userData.organization_id)
      .is('product_id', null)
      .order('product_name', { ascending: true })

    if (error) {
      console.error('Error fetching unlinked items:', error)
      return NextResponse.json(
        { error: { message: 'Failed to fetch unlinked items' } },
        { status: 500 }
      )
    }

    // Group by product_name and aggregate data
    const groupedItems = new Map<string, {
      product_name: string
      total_quantity: number
      total_revenue: number
      avg_unit_price: number
      transaction_count: number
      first_seen: string
      last_seen: string
      transaction_item_ids: string[]
    }>()

    unlinkedItems?.forEach((item: any) => {
      const transaction = Array.isArray(item.payment_transactions) 
        ? item.payment_transactions[0] 
        : item.payment_transactions

      // Skip items from FAILED or CANCELLED transactions
      if (transaction && (transaction.status === 'FAILED' || transaction.status === 'CANCELLED')) {
        return
      }

      const name = item.product_name
      if (!groupedItems.has(name)) {
        groupedItems.set(name, {
          product_name: name,
          total_quantity: 0,
          total_revenue: 0,
          avg_unit_price: 0,
          transaction_count: 0,
          first_seen: item.created_at,
          last_seen: item.created_at,
          transaction_item_ids: []
        })
      }

      const group = groupedItems.get(name)!
      group.total_quantity += parseFloat(item.quantity) || 0
      group.total_revenue += parseFloat(item.total_price) || 0
      group.transaction_count += 1
      group.transaction_item_ids.push(item.id)
      
      if (new Date(item.created_at) < new Date(group.first_seen)) {
        group.first_seen = item.created_at
      }
      if (new Date(item.created_at) > new Date(group.last_seen)) {
        group.last_seen = item.created_at
      }
    })

    // Calculate average unit price
    groupedItems.forEach((group) => {
      group.avg_unit_price = group.total_quantity > 0 
        ? group.total_revenue / group.total_quantity 
        : 0
    })

    return NextResponse.json({ 
      items: Array.from(groupedItems.values()).sort((a, b) => 
        b.total_revenue - a.total_revenue // Sort by revenue descending
      )
    })
  } catch (error) {
    console.error('Unlinked items API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}



