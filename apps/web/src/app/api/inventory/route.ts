import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/inventory - Get all inventory items for the organization
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
    const includeInactive = searchParams.get('include_inactive') === 'true'
    const category = searchParams.get('category')
    const lowStock = searchParams.get('low_stock') === 'true'

    // Build query
    let query = supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers (
          id,
          name
        )
      `)
      .eq('organization_id', userData.organization_id)
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: items, error: itemsError } = await query

    if (itemsError) {
      console.error('Inventory items fetch error:', itemsError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch inventory items' } },
        { status: 500 }
      )
    }

    // Filter low stock items if requested
    let filteredItems = items || []
    if (lowStock) {
      filteredItems = filteredItems.filter((item: any) => 
        item.current_stock <= item.reorder_point
      )
    }

    return NextResponse.json({ items: filteredItems })
  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/inventory - Create a new inventory item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      category, 
      description, 
      current_stock, 
      unit, 
      reorder_point, 
      reorder_quantity, 
      cost_per_unit,
      cost_per_unit_netto,
      cost_per_unit_brutto,
      vat_rate,
      supplier_id 
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
      .select('organization_id, role')
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
        { error: { message: 'Insufficient permissions. Only managers and owners can create inventory items.' } },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: { message: 'name is required' } },
        { status: 400 }
      )
    }

    if (!unit || unit.trim().length === 0) {
      return NextResponse.json(
        { error: { message: 'unit is required' } },
        { status: 400 }
      )
    }

    // Create inventory item
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .insert({
        organization_id: userData.organization_id,
        name: name.trim(),
        category: category?.trim() || null,
        description: description?.trim() || null,
        current_stock: current_stock || 0,
        unit: unit.trim(),
        reorder_point: reorder_point || 0,
        reorder_quantity: reorder_quantity || 0,
        cost_per_unit: cost_per_unit || cost_per_unit_brutto || 0,
        cost_per_unit_netto: cost_per_unit_netto ? parseFloat(cost_per_unit_netto) : null,
        cost_per_unit_brutto: cost_per_unit_brutto ? parseFloat(cost_per_unit_brutto) : (cost_per_unit ? parseFloat(cost_per_unit) : null),
        vat_rate: vat_rate ? parseFloat(vat_rate) : 19.0,
        supplier_id: supplier_id || null,
        is_active: true
      })
      .select()
      .single()

    if (itemError) {
      console.error('Inventory item creation error:', itemError)
      return NextResponse.json(
        { error: { message: 'Failed to create inventory item' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Inventory item creation API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

