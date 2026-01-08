import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/products - Get all products for the organization
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
    const includeRecipes = searchParams.get('include_recipes') === 'true'

    // Build query
    let query = supabase
      .from('products')
      .select(includeRecipes ? `
        *,
        product_recipes (
          id,
          inventory_item_id,
          quantity,
          unit,
          notes,
          inventory_items (
            id,
            name,
            unit,
            current_stock
          )
        ),
        inventory_items (
          id,
          name,
          unit,
          current_stock
        )
      ` : '*')
      .eq('organization_id', userData.organization_id)
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: products, error: productsError } = await query

    if (productsError) {
      console.error('Products fetch error:', productsError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch products' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ products: products || [] })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      description, 
      category, 
      price,
      price_netto,
      price_brutto,
      vat_rate,
      sku, 
      barcode, 
      is_direct_sale,
      inventory_item_id 
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
        { error: { message: 'Insufficient permissions. Only managers and owners can create products.' } },
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

    if ((price_brutto === undefined || price_brutto === null) && (price === undefined || price === null)) {
      return NextResponse.json(
        { error: { message: 'price_brutto or price is required' } },
        { status: 400 }
      )
    }

    // If direct sale, verify inventory item exists and belongs to organization
    if (is_direct_sale && inventory_item_id) {
      const { data: inventoryItem, error: itemError } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('id', inventory_item_id)
        .eq('organization_id', userData.organization_id)
        .single()

      if (itemError || !inventoryItem) {
        return NextResponse.json(
          { error: { message: 'Inventory item not found' } },
          { status: 404 }
        )
      }
    }

    // Create product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        organization_id: userData.organization_id,
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        price: price_brutto ? parseFloat(price_brutto) : (price ? parseFloat(price) : 0),
        price_netto: price_netto ? parseFloat(price_netto) : null,
        price_brutto: price_brutto ? parseFloat(price_brutto) : (price ? parseFloat(price) : null),
        vat_rate: vat_rate ? parseFloat(vat_rate) : 19.0,
        sku: sku?.trim() || null,
        barcode: barcode?.trim() || null,
        is_direct_sale: is_direct_sale || false,
        inventory_item_id: is_direct_sale ? inventory_item_id : null,
        is_active: true
      })
      .select()
      .single()

    if (productError) {
      console.error('Product creation error:', productError)
      return NextResponse.json(
        { error: { message: 'Failed to create product' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Product creation API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

