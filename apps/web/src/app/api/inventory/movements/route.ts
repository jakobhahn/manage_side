import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/inventory/movements - Get inventory movements
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
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item_id')
    const movementType = searchParams.get('movement_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Build query - join with payment_transactions to get transaction_date if reference_number matches
    let query = supabase
      .from('inventory_movements')
      .select(`
        *,
        inventory_items (
          id,
          name,
          unit
        ),
        users:performed_by (
          id,
          name
        )
      `)
      .eq('organization_id', userData.organization_id)
      .order('movement_date', { ascending: false })
      .limit(limit)

    if (itemId) {
      query = query.eq('item_id', itemId)
    }

    if (movementType) {
      query = query.eq('movement_type', movementType)
    }

    if (startDate) {
      query = query.gte('movement_date', startDate)
    }

    if (endDate) {
      query = query.lte('movement_date', endDate)
    }

    const { data: movements, error: movementsError } = await query

    if (movementsError) {
      console.error('Inventory movements fetch error:', movementsError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch inventory movements' } },
        { status: 500 }
      )
    }

    // For movements with reference_number, get transaction_date from payment_transactions
    if (movements && movements.length > 0) {
      // Get all unique reference_numbers (transaction_ids)
      const referenceNumbers = movements
        .map(m => m.reference_number)
        .filter(Boolean) as string[]
      
      if (referenceNumbers.length > 0) {
        // Fetch all matching transactions in one query
        const { data: transactions } = await supabase
          .from('payment_transactions')
          .select('transaction_id, transaction_date')
          .eq('organization_id', userData.organization_id)
          .in('transaction_id', referenceNumbers)
        
        // Create a map for quick lookup
        const transactionDateMap = new Map(
          (transactions || []).map(t => [t.transaction_id, t.transaction_date])
        )
        
        // Update movements with transaction dates
        const movementsWithDates = movements.map(movement => {
          if (movement.reference_number && transactionDateMap.has(movement.reference_number)) {
            return {
              ...movement,
              movement_date: transactionDateMap.get(movement.reference_number)
            }
          }
          return movement
        })
        
        return NextResponse.json({ movements: movementsWithDates })
      }
    }

    return NextResponse.json({ movements: movements || [] })
  } catch (error) {
    console.error('Inventory movements API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/inventory/movements - Create a new inventory movement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      item_id, 
      movement_type, 
      quantity, 
      unit_cost, 
      reason, 
      reference_number,
      movement_date
    } = body

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

    // Check if user has permission
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions. Only managers and owners can create inventory movements.' } },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!item_id) {
      return NextResponse.json(
        { error: { message: 'item_id is required' } },
        { status: 400 }
      )
    }

    if (!movement_type || !['in', 'out', 'adjustment', 'waste', 'transfer'].includes(movement_type)) {
      return NextResponse.json(
        { error: { message: 'movement_type is required and must be one of: in, out, adjustment, waste, transfer' } },
        { status: 400 }
      )
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: { message: 'quantity is required and must be greater than 0' } },
        { status: 400 }
      )
    }

    // Verify item exists and belongs to organization
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select('id, organization_id, current_stock')
      .eq('id', item_id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        { error: { message: 'Inventory item not found' } },
        { status: 404 }
      )
    }

    // Check stock availability for out/waste movements
    if ((movement_type === 'out' || movement_type === 'waste') && item.current_stock < quantity) {
      return NextResponse.json(
        { error: { message: `Insufficient stock. Current stock: ${item.current_stock}` } },
        { status: 400 }
      )
    }

    // Calculate total cost
    const totalCost = unit_cost ? unit_cost * quantity : null

    // Create movement
    const { data: movement, error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        organization_id: userData.organization_id,
        item_id: item_id,
        movement_type: movement_type,
        quantity: quantity,
        unit_cost: unit_cost || null,
        total_cost: totalCost,
        reason: reason?.trim() || null,
        reference_number: reference_number?.trim() || null,
        performed_by: userData.id,
        movement_date: movement_date || new Date().toISOString()
      })
      .select(`
        *,
        inventory_items (
          id,
          name,
          unit
        ),
        users:performed_by (
          id,
          name
        )
      `)
      .single()

    if (movementError) {
      console.error('Inventory movement creation error:', movementError)
      return NextResponse.json(
        { error: { message: 'Failed to create inventory movement' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ movement }, { status: 201 })
  } catch (error) {
    console.error('Inventory movement creation API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

