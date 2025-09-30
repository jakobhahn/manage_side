import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Encrypt function for API credentials
function encrypt(data: string, key: string): { encrypted: string; salt: string } {
  const keyBuffer = Buffer.from(key, 'hex')
  const salt = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, salt)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return {
    encrypted,
    salt: salt.toString('hex')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { merchant_code, api_key, api_secret } = await request.json()
    
    if (!merchant_code || !api_key || !api_secret) {
      return NextResponse.json(
        { error: { message: 'Merchant code, API key, and API secret are required' } },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find organization by merchant code
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('id, organization_id')
      .eq('merchant_code', merchant_code)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

    // Encrypt API credentials
    const encryptionKey = process.env.ENCRYPTION_KEY!
    const encryptedApiKey = encrypt(api_key, encryptionKey)
    const encryptedApiSecret = encrypt(api_secret, encryptionKey)

    // Update merchant code with encrypted credentials
    const { error: updateError } = await supabase
      .from('merchant_codes')
      .update({
        api_key_encrypted: encryptedApiKey.encrypted,
        api_secret_encrypted: encryptedApiSecret.encrypted,
        encryption_salt: encryptedApiKey.salt, // Use same salt for both
        updated_at: new Date().toISOString()
      })
      .eq('id', merchantCode.id)

    if (updateError) {
      console.error('Failed to update merchant code:', updateError)
      return NextResponse.json(
        { error: { message: 'Failed to save API credentials' } },
        { status: 500 }
      )
    }

    // Test the API credentials by making a SumUp API call
    try {
      const sumupApiUrl = 'https://api.sumup.com/v0.1/me/transactions'
      const auth = Buffer.from(`${api_key}:${api_secret}`).toString('base64')
      
      const response = await fetch(sumupApiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('SumUp API Test Error:', response.status, errorText)
        return NextResponse.json(
          { 
            success: false,
            message: 'API credentials saved but SumUp API test failed',
            error: `SumUp API Error: ${response.status} - ${errorText}`,
            merchant_code: merchant_code
          },
          { status: 200 }
        )
      }

      const transactions = await response.json()
      console.log('SumUp API test successful:', transactions.length, 'transactions found')

      return NextResponse.json({ 
        success: true,
        message: 'API credentials saved and SumUp API test successful',
        merchant_code: merchant_code,
        transactionsFound: transactions.length,
        sampleTransaction: transactions[0] || null
      })

    } catch (apiError) {
      console.error('SumUp API test failed:', apiError)
      return NextResponse.json(
        { 
          success: false,
          message: 'API credentials saved but SumUp API test failed',
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
          merchant_code: merchant_code
        },
        { status: 200 }
      )
    }

  } catch (error) {
    console.error('Test live integration error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

