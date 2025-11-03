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

    // Create simple state
    const state = `merchant_${merchant_code}_${Date.now()}`
    const redirectUri = `${request.nextUrl.origin}/api/auth/sumup/callback`

    // Try different OAuth configurations
    const oauthConfigs = [
      {
        name: 'Minimal OAuth (no scope)',
        url: `https://api.sumup.com/authorize?response_type=code&client_id=${merchantCode.oauth_client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
      },
      {
        name: 'Basic payments scope',
        url: `https://api.sumup.com/authorize?response_type=code&client_id=${merchantCode.oauth_client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=payments&state=${state}`
      },
      {
        name: 'Alternative redirect URI (without /api)',
        url: `https://api.sumup.com/authorize?response_type=code&client_id=${merchantCode.oauth_client_id}&redirect_uri=${encodeURIComponent(request.nextUrl.origin + '/callback')}&scope=payments&state=${state}`
      }
    ]

    return NextResponse.json({
      success: true,
      merchant_code: merchant_code,
      oauth_client_id: merchantCode.oauth_client_id,
      redirect_uri: redirectUri,
      state: state,
      configs: oauthConfigs,
      instructions: [
        '1. Teste die URLs nacheinander',
        '2. Falls alle fehlschlagen, prüfe SumUp Developer Dashboard',
        '3. Stelle sicher, dass die Redirect URI exakt übereinstimmt',
        '4. Prüfe ob die App aktiviert ist'
      ]
    })

  } catch (error) {
    console.error('Simple OAuth error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}





