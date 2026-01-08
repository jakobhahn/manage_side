import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/products/[id]/recipes - Get recipes for a product
export async function GET(
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
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    const { data: recipes, error } = await supabase
      .from('product_recipes')
      .select(`
        *,
        inventory_items (
          id,
          name,
          unit,
          current_stock,
          cost_per_unit
        )
      `)
      .eq('product_id', id)
      .eq('organization_id', userData.organization_id)

    if (error) {
      return NextResponse.json({ error: { message: 'Failed to fetch recipes' } }, { status: 500 })
    }

    return NextResponse.json({ recipes: recipes || [] })
  } catch (error) {
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

// POST /api/products/[id]/recipes - Add recipe item to product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { inventory_item_id, quantity, unit, notes } = body
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

    if (!inventory_item_id || !quantity || !unit) {
      return NextResponse.json({ error: { message: 'inventory_item_id, quantity, and unit are required' } }, { status: 400 })
    }

    const { data: recipe, error } = await supabase
      .from('product_recipes')
      .insert({
        organization_id: userData.organization_id,
        product_id: id,
        inventory_item_id,
        quantity: parseFloat(quantity),
        unit: unit.trim(),
        notes: notes?.trim() || null
      })
      .select(`
        *,
        inventory_items (
          id,
          name,
          unit,
          current_stock,
          cost_per_unit
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: { message: 'Failed to create recipe' } }, { status: 500 })
    }

    return NextResponse.json({ recipe }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}



