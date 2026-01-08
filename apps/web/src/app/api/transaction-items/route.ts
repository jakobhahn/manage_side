import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/transaction-items - Get transaction items
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

    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transaction_id')
    const productId = searchParams.get('product_id')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('transaction_items')
      .select(`
        *,
        products (
          id,
          name,
          category
        ),
        payment_transactions (
          id,
          transaction_id,
          transaction_date
        )
      `)
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (transactionId) {
      query = query.eq('transaction_id', transactionId)
    }

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data: items, error } = await query

    if (error) {
      return NextResponse.json({ error: { message: 'Failed to fetch transaction items' } }, { status: 500 })
    }

    return NextResponse.json({ items: items || [] })
  } catch (error) {
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

// POST /api/transaction-items - Create transaction items (usually called from SumUp sync)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction_id, items } = body

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
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    if (!transaction_id || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: { message: 'transaction_id and items array are required' } }, { status: 400 })
    }

    // Verify transaction exists
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('id, organization_id')
      .eq('id', transaction_id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (!transaction) {
      return NextResponse.json({ error: { message: 'Transaction not found' } }, { status: 404 })
    }

    // Process each item
    const createdItems = []
    for (const item of items) {
      const { product_name, quantity, unit_price, total_price, product_id, raw_data } = item

      // Try to find product by name or ID
      let foundProductId = product_id || null
      if (!foundProductId && product_name) {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('organization_id', userData.organization_id)
          .ilike('name', product_name)
          .limit(1)
          .single()
        
        if (product) {
          foundProductId = product.id
        }
      }

      const { data: createdItem, error: insertError } = await supabase
        .from('transaction_items')
        .insert({
          organization_id: userData.organization_id,
          transaction_id: transaction.id,
          product_id: foundProductId,
          product_name: product_name || 'Unbekannt',
          quantity: parseFloat(quantity) || 1,
          unit_price: parseFloat(unit_price) || 0,
          total_price: parseFloat(total_price) || 0,
          raw_data: raw_data || null
        })
        .select()
        .single()

      if (!insertError && createdItem) {
        createdItems.push(createdItem)
      }
    }

    return NextResponse.json({ items: createdItems }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}



