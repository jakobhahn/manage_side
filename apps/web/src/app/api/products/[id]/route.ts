import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/products/[id] - Get a specific product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
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

    const { data: product, error } = await supabase
      .from('products')
      .select(`
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
      `)
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (error || !product) {
      return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

// PUT /api/products/[id] - Update a product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
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

    if (!userData || !['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: { message: 'Insufficient permissions' } }, { status: 403 })
    }

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.category !== undefined) updateData.category = body.category?.trim() || null
    if (body.price_netto !== undefined) updateData.price_netto = body.price_netto ? parseFloat(body.price_netto) : null
    if (body.price_brutto !== undefined) {
      updateData.price_brutto = body.price_brutto ? parseFloat(body.price_brutto) : null
      updateData.price = body.price_brutto ? parseFloat(body.price_brutto) : (body.price ? parseFloat(body.price) : 0)
    } else if (body.price !== undefined) {
      updateData.price = parseFloat(body.price)
      updateData.price_brutto = parseFloat(body.price)
    }
    if (body.vat_rate !== undefined) updateData.vat_rate = parseFloat(body.vat_rate) || 19.0
    if (body.sku !== undefined) updateData.sku = body.sku?.trim() || null
    if (body.barcode !== undefined) updateData.barcode = body.barcode?.trim() || null
    if (body.is_direct_sale !== undefined) updateData.is_direct_sale = body.is_direct_sale
    if (body.inventory_item_id !== undefined) updateData.inventory_item_id = body.inventory_item_id
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .select()
      .single()

    if (error || !product) {
      return NextResponse.json({ error: { message: 'Failed to update product' } }, { status: 500 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

// DELETE /api/products/[id] - Delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    if (!userData || !['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json({ error: { message: 'Insufficient permissions' } }, { status: 403 })
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('organization_id', userData.organization_id)

    if (error) {
      return NextResponse.json({ error: { message: 'Failed to delete product' } }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

