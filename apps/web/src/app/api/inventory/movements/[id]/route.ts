import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/inventory/movements/[id] - Get a single inventory movement
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

    // Get movement with related data
    const { data: movement, error: movementError } = await supabase
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
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (movementError || !movement) {
      return NextResponse.json(
        { error: { message: 'Inventory movement not found' } },
        { status: 404 }
      )
    }

    // If movement has reference_number, get transaction_date from payment_transactions
    if (movement.reference_number) {
      const { data: transaction } = await supabase
        .from('payment_transactions')
        .select('transaction_id, transaction_date')
        .eq('organization_id', userData.organization_id)
        .eq('transaction_id', movement.reference_number)
        .single()
      
      if (transaction) {
        movement.movement_date = transaction.transaction_date
      }
    }

    return NextResponse.json({ movement })
  } catch (error) {
    console.error('Inventory movement fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/movements/[id] - Update an inventory movement
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
        { error: { message: 'Insufficient permissions. Only managers and owners can update inventory movements.' } },
        { status: 403 }
      )
    }

    // Get existing movement to check ownership and get old values
    const { data: existingMovement, error: existingError } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (existingError || !existingMovement) {
      return NextResponse.json(
        { error: { message: 'Inventory movement not found' } },
        { status: 404 }
      )
    }

    // Validate movement_type if provided
    if (movement_type && !['in', 'out', 'adjustment', 'waste', 'transfer'].includes(movement_type)) {
      return NextResponse.json(
        { error: { message: 'movement_type must be one of: in, out, adjustment, waste, transfer' } },
        { status: 400 }
      )
    }

    // Validate quantity if provided
    if (quantity !== undefined && quantity <= 0) {
      return NextResponse.json(
        { error: { message: 'quantity must be greater than 0' } },
        { status: 400 }
      )
    }

    // If item_id is being changed, verify new item exists
    const targetItemId = item_id || existingMovement.item_id
    if (item_id && item_id !== existingMovement.item_id) {
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
    }

    // Calculate total cost
    const finalQuantity = quantity !== undefined ? quantity : existingMovement.quantity
    const finalUnitCost = unit_cost !== undefined ? unit_cost : existingMovement.unit_cost
    const totalCost = finalUnitCost ? finalUnitCost * finalQuantity : null

    // Prepare update data
    const updateData: any = {}
    if (item_id !== undefined) updateData.item_id = item_id
    if (movement_type !== undefined) updateData.movement_type = movement_type
    if (quantity !== undefined) updateData.quantity = quantity
    if (unit_cost !== undefined) updateData.unit_cost = unit_cost
    if (totalCost !== undefined) updateData.total_cost = totalCost
    if (reason !== undefined) updateData.reason = reason?.trim() || null
    if (reference_number !== undefined) updateData.reference_number = reference_number?.trim() || null
    if (movement_date !== undefined) updateData.movement_date = movement_date

    // Update movement
    const { data: updatedMovement, error: updateError } = await supabase
      .from('inventory_movements')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
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

    if (updateError) {
      console.error('Inventory movement update error:', updateError)
      return NextResponse.json(
        { error: { message: 'Failed to update inventory movement' } },
        { status: 500 }
      )
    }

    // If quantity or movement_type changed, we need to adjust the stock
    // First, reverse the old movement's effect, then apply the new one
    if (quantity !== undefined || movement_type !== undefined || item_id !== undefined) {
      const oldItemId = existingMovement.item_id
      const oldQuantity = existingMovement.quantity
      const oldType = existingMovement.movement_type
      
      // Get current stock for old item
      const { data: oldItem } = await supabase
        .from('inventory_items')
        .select('current_stock')
        .eq('id', oldItemId)
        .single()
      
      let oldStock = oldItem?.current_stock || 0
      
      // Reverse old movement
      if (oldType === 'in') {
        oldStock = oldStock - oldQuantity
      } else if (oldType === 'out' || oldType === 'waste') {
        oldStock = oldStock + oldQuantity
      } else if (oldType === 'adjustment') {
        // For adjustments, we can't easily reverse without knowing the previous stock
        // We'll need to recalculate from all movements
        console.warn('Adjustment movement updated - recalculating stock from all movements')
        const { data: allMovements } = await supabase
          .from('inventory_movements')
          .select('movement_type, quantity')
          .eq('item_id', oldItemId)
          .neq('id', id) // Exclude the movement being updated
      
        let calculatedStock = 0
        allMovements?.forEach((m: any) => {
          if (m.movement_type === 'in') {
            calculatedStock += m.quantity
          } else if (m.movement_type === 'out' || m.movement_type === 'waste') {
            calculatedStock -= m.quantity
          } else if (m.movement_type === 'adjustment') {
            calculatedStock = m.quantity
          }
        })
        oldStock = calculatedStock
      }

      // Apply new movement
      const newItemId = item_id || existingMovement.item_id
      const newQuantity = quantity !== undefined ? quantity : existingMovement.quantity
      const newType = movement_type !== undefined ? movement_type : existingMovement.movement_type
      
      let newStock = oldStock
      
      if (newType === 'in') {
        newStock = oldStock + newQuantity
      } else if (newType === 'out' || newType === 'waste') {
        newStock = oldStock - newQuantity
      } else if (newType === 'adjustment') {
        newStock = newQuantity
      }
      
      // Update stock
      await supabase
        .from('inventory_items')
        .update({ 
          current_stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', newItemId)
    }

    return NextResponse.json({ movement: updatedMovement })
  } catch (error) {
    console.error('Inventory movement update API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/movements/[id] - Delete an inventory movement
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
        { error: { message: 'Insufficient permissions. Only managers and owners can delete inventory movements.' } },
        { status: 403 }
      )
    }

    // Get existing movement to reverse stock effect
    const { data: existingMovement, error: existingError } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (existingError || !existingMovement) {
      return NextResponse.json(
        { error: { message: 'Inventory movement not found' } },
        { status: 404 }
      )
    }

    // Reverse the stock effect before deleting
    // Get current stock
    const { data: item } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', existingMovement.item_id)
      .single()
    
    let newStock = item?.current_stock || 0
    
    if (existingMovement.movement_type === 'in') {
      newStock = newStock - existingMovement.quantity
    } else if (existingMovement.movement_type === 'out' || existingMovement.movement_type === 'waste') {
      newStock = newStock + existingMovement.quantity
    } else if (existingMovement.movement_type === 'adjustment') {
      // For adjustments, recalculate from all remaining movements
      const { data: allMovements } = await supabase
        .from('inventory_movements')
        .select('movement_type, quantity')
        .eq('item_id', existingMovement.item_id)
        .neq('id', id) // Exclude the movement being deleted
      
      let calculatedStock = 0
      allMovements?.forEach((m: any) => {
        if (m.movement_type === 'in') {
          calculatedStock += m.quantity
        } else if (m.movement_type === 'out' || m.movement_type === 'waste') {
          calculatedStock -= m.quantity
        } else if (m.movement_type === 'adjustment') {
          calculatedStock = m.quantity
        }
      })
      newStock = calculatedStock
    }
    
    await supabase
      .from('inventory_items')
      .update({ 
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMovement.item_id)

    // Delete movement
    const { error: deleteError } = await supabase
      .from('inventory_movements')
      .delete()
      .eq('id', id)
      .eq('organization_id', userData.organization_id)

    if (deleteError) {
      console.error('Inventory movement deletion error:', deleteError)
      return NextResponse.json(
        { error: { message: 'Failed to delete inventory movement' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Inventory movement deletion API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

