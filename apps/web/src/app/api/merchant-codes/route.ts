import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user data to check role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission (owner or manager)
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Fetch merchant codes for the organization
    const { data: merchantCodes, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })

    if (merchantError) {
      console.error('Merchant codes fetch error:', merchantError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch merchant codes' } },
        { status: 500 }
      )
    }

    return NextResponse.json(merchantCodes || [])
  } catch (error) {
    console.error('Merchant codes fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { merchant_code, description } = await request.json()

    if (!merchant_code || !description) {
      return NextResponse.json(
        { error: { message: 'merchant_code and description are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user data to check role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission (owner or manager)
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Check if merchant code already exists
    const { data: existingCode } = await supabase
      .from('merchant_codes')
      .select('id')
      .eq('merchant_code', merchant_code)
      .single()

    if (existingCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code already exists' } },
        { status: 400 }
      )
    }

    // Insert new merchant code
    const { data: newMerchantCode, error: insertError } = await supabase
      .from('merchant_codes')
      .insert({
        organization_id: userData.organization_id,
        merchant_code,
        description,
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Merchant code creation error:', insertError)
      return NextResponse.json(
        { error: { message: 'Failed to create merchant code' } },
        { status: 500 }
      )
    }

    return NextResponse.json(newMerchantCode)
  } catch (error) {
    console.error('Merchant code creation error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
