import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
    const { merchantCodeId, activate } = await request.json()

    if (!merchantCodeId || typeof activate !== 'boolean') {
      return NextResponse.json(
        { error: { message: 'Merchant code ID and activate flag are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key
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

    // Get the merchant code to verify ownership
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('merchant_code, organization_id, is_active')
      .eq('id', merchantCodeId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (merchantError || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found or access denied' } },
        { status: 404 }
      )
    }

    // Check if already in the desired state
    if (merchantCode.is_active === activate) {
      return NextResponse.json(
        { error: { message: `Merchant code is already ${activate ? 'activated' : 'deactivated'}` } },
        { status: 400 }
      )
    }

    // Toggle the merchant code status
    const { error: updateError } = await supabase
      .from('merchant_codes')
      .update({ 
        is_active: activate,
        updated_at: new Date().toISOString()
      })
      .eq('id', merchantCodeId)
      .eq('organization_id', userData.organization_id)

    if (updateError) {
      console.error('Error toggling merchant code:', updateError)
      return NextResponse.json(
        { error: { message: 'Failed to update merchant code status' } },
        { status: 500 }
      )
    }

    const action = activate ? 'activated' : 'deactivated'
    console.log(`✅ Successfully ${action} merchant code: ${merchantCode.merchant_code}`)

    return NextResponse.json({
      success: true,
      message: `Merchant code ${action} successfully`,
      is_active: activate
    })

  } catch (error) {
    console.error('Toggle merchant code error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

