import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/inventory/[id] - Get a specific inventory item
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

    // Get inventory item
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers (
          id,
          name
        )
      `)
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        { error: { message: 'Inventory item not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Inventory item fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/[id] - Update an inventory item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      supplier_id,
      is_active 
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
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Build update object
    const updateData: any = {}

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: { message: 'name cannot be empty' } },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (category !== undefined) {
      updateData.category = category?.trim() || null
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    if (current_stock !== undefined) {
      updateData.current_stock = current_stock
    }

    if (unit !== undefined) {
      if (!unit || unit.trim().length === 0) {
        return NextResponse.json(
          { error: { message: 'unit cannot be empty' } },
          { status: 400 }
        )
      }
      updateData.unit = unit.trim()
    }

    if (reorder_point !== undefined) {
      updateData.reorder_point = reorder_point
    }

    if (reorder_quantity !== undefined) {
      updateData.reorder_quantity = reorder_quantity
    }

    if (cost_per_unit !== undefined) {
      updateData.cost_per_unit = cost_per_unit
    }

    if (cost_per_unit_netto !== undefined) {
      updateData.cost_per_unit_netto = cost_per_unit_netto ? parseFloat(cost_per_unit_netto) : null
    }

    if (cost_per_unit_brutto !== undefined) {
      updateData.cost_per_unit_brutto = cost_per_unit_brutto ? parseFloat(cost_per_unit_brutto) : null
      // Keep legacy cost_per_unit in sync
      if (cost_per_unit_brutto) {
        updateData.cost_per_unit = parseFloat(cost_per_unit_brutto)
      }
    }

    if (vat_rate !== undefined) {
      updateData.vat_rate = vat_rate ? parseFloat(vat_rate) : 19.0
    }

    if (supplier_id !== undefined) {
      updateData.supplier_id = supplier_id || null
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active
    }

    // Update inventory item
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .select()
      .single()

    if (itemError) {
      console.error('Inventory item update error:', itemError)
      return NextResponse.json(
        { error: { message: 'Failed to update inventory item' } },
        { status: 500 }
      )
    }

    if (!item) {
      return NextResponse.json(
        { error: { message: 'Inventory item not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Inventory item update error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/[id] - Delete an inventory item
export async function DELETE(
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
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Delete inventory item
    const { error: deleteError } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('organization_id', userData.organization_id)

    if (deleteError) {
      console.error('Inventory item deletion error:', deleteError)
      return NextResponse.json(
        { error: { message: 'Failed to delete inventory item' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Inventory item deletion error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

