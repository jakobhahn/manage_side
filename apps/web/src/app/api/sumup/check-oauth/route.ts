import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchant_code = searchParams.get('merchant_code') || 'M2ZGKSRN'
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find merchant code with all OAuth fields
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

    // Check what OAuth fields are available
    const oauthFields = {
      has_api_key: !!merchantCode.api_key_encrypted,
      has_api_secret: !!merchantCode.api_secret_encrypted,
      has_oauth_access_token: !!merchantCode.oauth_access_token_encrypted,
      has_oauth_refresh_token: !!merchantCode.oauth_refresh_token_encrypted,
      has_encryption_salt: !!merchantCode.encryption_salt,
      has_oauth_token_salt: !!merchantCode.oauth_token_salt,
      oauth_expires_at: merchantCode.oauth_expires_at,
      oauth_scope: merchantCode.oauth_scope,
      merchant_name: merchantCode.merchant_name,
      integration_type: merchantCode.integration_type
    }

    return NextResponse.json({
      success: true,
      merchant_code: merchant_code,
      oauth_status: oauthFields,
      raw_data: merchantCode // For debugging - remove in production
    })

  } catch (error) {
    console.error('Check OAuth error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}









