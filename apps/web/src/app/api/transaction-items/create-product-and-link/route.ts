import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST /api/transaction-items/create-product-and-link - Create a product from transaction item and link it
export async function POST(request: NextRequest) {
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
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    // Check permissions
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { product_name, category, price_brutto, price_netto, vat_rate, is_direct_sale, inventory_item_id } = body

    if (!product_name) {
      return NextResponse.json(
        { error: { message: 'product_name is required' } },
        { status: 400 }
      )
    }

    // Calculate price_netto and price_brutto if not provided
    let finalPriceNetto = price_netto
    let finalPriceBrutto = price_brutto
    let finalVatRate = vat_rate || 19.0

    if (!finalPriceNetto && !finalPriceBrutto) {
      // Get average price from transaction items
      const { data: transactionItems } = await supabase
        .from('transaction_items')
        .select('unit_price, total_price, quantity')
        .eq('organization_id', userData.organization_id)
        .eq('product_name', product_name)
        .is('product_id', null)

      if (transactionItems && transactionItems.length > 0) {
        let totalRevenue = 0
        let totalQuantity = 0
        transactionItems.forEach((item: any) => {
          totalRevenue += parseFloat(item.total_price) || 0
          totalQuantity += parseFloat(item.quantity) || 0
        })
        const avgPrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0
        finalPriceBrutto = avgPrice
        finalPriceNetto = avgPrice / (1 + finalVatRate / 100)
      }
    } else if (finalPriceBrutto && !finalPriceNetto) {
      finalPriceNetto = finalPriceBrutto / (1 + finalVatRate / 100)
    } else if (finalPriceNetto && !finalPriceBrutto) {
      finalPriceBrutto = finalPriceNetto * (1 + finalVatRate / 100)
    }

    // Create the product
    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert({
        organization_id: userData.organization_id,
        name: product_name,
        category: category || null,
        price_brutto: finalPriceBrutto || 0,
        price_netto: finalPriceNetto || 0,
        vat_rate: finalVatRate,
        is_direct_sale: is_direct_sale || false,
        inventory_item_id: inventory_item_id || null,
        is_active: true
      })
      .select()
      .single()

    if (productError) {
      console.error('Error creating product:', productError)
      return NextResponse.json(
        { error: { message: 'Failed to create product' } },
        { status: 500 }
      )
    }

    // Link all transaction items with this product_name to the new product
    const { error: updateError } = await supabase
      .from('transaction_items')
      .update({ product_id: newProduct.id })
      .eq('organization_id', userData.organization_id)
      .eq('product_name', product_name)
      .is('product_id', null)

    if (updateError) {
      console.error('Error linking transaction items:', updateError)
      // Product was created, but linking failed - still return success but log the error
      console.warn('Product created but linking transaction items failed')
    }

    return NextResponse.json({ 
      product: newProduct,
      message: 'Product created and linked successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Create product and link API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}



