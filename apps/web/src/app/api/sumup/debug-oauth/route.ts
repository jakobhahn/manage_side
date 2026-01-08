import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchant_code = searchParams.get('merchant_code') || 'M2ZGKSRN'
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get merchant code details
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('*')
      .eq('merchant_code', merchant_code)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

    // Build OAuth URL for debugging
    const stateData = {
      organization_id: merchantCode.organization_id,
      merchant_code: merchant_code,
      timestamp: Date.now()
    }
    
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64')
    const redirectUri = `${request.nextUrl.origin}/api/auth/sumup/callback`

    const authUrl = new URL('https://api.sumup.com/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', merchantCode.oauth_client_id)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'payments transactions')
    authUrl.searchParams.set('state', state)

    return NextResponse.json({
      success: true,
      debug_info: {
        merchant_code: merchant_code,
        oauth_client_id: merchantCode.oauth_client_id,
        redirect_uri: redirectUri,
        scope: 'payments transactions',
        state: state,
        state_decoded: stateData,
        full_auth_url: authUrl.toString(),
        has_client_secret: !!merchantCode.oauth_client_secret_encrypted,
        integration_type: merchantCode.integration_type
      },
      // Alternative URLs to try
      alternative_urls: [
        // Try with different scopes
        {
          name: 'Basic scope only',
          url: `https://api.sumup.com/authorize?response_type=code&client_id=${merchantCode.oauth_client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=payments&state=${state}`
        },
        {
          name: 'Transactions scope only', 
          url: `https://api.sumup.com/authorize?response_type=code&client_id=${merchantCode.oauth_client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=transactions&state=${state}`
        },
        {
          name: 'No scope',
          url: `https://api.sumup.com/authorize?response_type=code&client_id=${merchantCode.oauth_client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
        }
      ]
    })

  } catch (error) {
    console.error('Debug OAuth error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}









