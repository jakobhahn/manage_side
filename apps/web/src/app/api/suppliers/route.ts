import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/suppliers - Get all suppliers for the organization
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

    // Build query
    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: suppliers, error: suppliersError } = await query

    if (suppliersError) {
      console.error('Suppliers fetch error:', suppliersError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch suppliers' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ suppliers: suppliers || [] })
  } catch (error) {
    console.error('Suppliers API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/suppliers - Create a new supplier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      contact_person, 
      email, 
      phone, 
      address, 
      notes 
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
        { error: { message: 'Insufficient permissions. Only managers and owners can create suppliers.' } },
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

    // Create supplier
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        organization_id: userData.organization_id,
        name: name.trim(),
        contact_person: contact_person?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address || {},
        notes: notes?.trim() || null,
        is_active: true
      })
      .select()
      .single()

    if (supplierError) {
      console.error('Supplier creation error:', supplierError)
      return NextResponse.json(
        { error: { message: 'Failed to create supplier' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ supplier }, { status: 201 })
  } catch (error) {
    console.error('Supplier creation API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}



