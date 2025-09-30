import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { merchant_code } = await request.json()
    
    if (!merchant_code) {
      return NextResponse.json(
        { error: { message: 'Merchant code is required' } },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find organization by merchant code
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('organization_id')
      .eq('merchant_code', merchant_code)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

    // Create state parameter with organization and merchant info
    const stateData = {
      organization_id: merchantCode.organization_id,
      merchant_code: merchant_code,
      timestamp: Date.now()
    }
    
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

    // Get OAuth client_id from merchant code
    const { data: merchantData, error: merchantDataError } = await supabase
      .from('merchant_codes')
      .select('oauth_client_id')
      .eq('merchant_code', merchant_code)
      .eq('is_active', true)
      .single()

    if (merchantDataError || !merchantData?.oauth_client_id) {
      return NextResponse.json(
        { error: { message: 'OAuth client_id not configured for this merchant code' } },
        { status: 400 }
      )
    }

    // Build OAuth authorization URL (no scope - let SumUp determine default scopes)
    const authUrl = new URL('https://api.sumup.com/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', merchantData.oauth_client_id)
    authUrl.searchParams.set('redirect_uri', `${request.nextUrl.origin}/api/auth/sumup/callback`)
    authUrl.searchParams.set('state', state)

    console.log('OAuth initiation for merchant:', merchant_code)

    return NextResponse.json({
      success: true,
      auth_url: authUrl.toString(),
      merchant_code: merchant_code
    })

  } catch (error) {
    console.error('OAuth initiation error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
