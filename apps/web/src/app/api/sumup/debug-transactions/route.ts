import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { merchantCode } = await request.json()

    if (!merchantCode) {
      return NextResponse.json({ error: 'Merchant code is required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Retrieve OAuth tokens for the merchant
    const { data: merchantData, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('oauth_access_token_encrypted, oauth_refresh_token_encrypted, encryption_salt')
      .eq('merchant_code', merchantCode)
      .single()

    if (merchantError || !merchantData) {
      console.error('Merchant not found or error fetching merchant data:', merchantError)
      return NextResponse.json({ error: 'Merchant not found or OAuth not configured' }, { status: 404 })
    }

    let accessToken = merchantData.oauth_access_token_encrypted
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not found for merchant' }, { status: 400 })
    }

    // COMPREHENSIVE DEBUG LOGIC
    console.log('=== SUMUP API DEBUG SESSION START ===')
    console.log('Merchant Code:', merchantCode)
    console.log('Access Token (first 20 chars):', accessToken.substring(0, 20) + '...')
    console.log('Access Token Length:', accessToken.length)
    
    // Test 1: Basic merchant info
    console.log('\n--- TEST 1: Basic Merchant Info ---')
    try {
      const merchantInfoResponse = await fetch(`https://api.sumup.com/v2.1/merchants/${merchantCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      
      console.log('Merchant Info Status:', merchantInfoResponse.status)
      console.log('Merchant Info Headers:', Object.fromEntries(merchantInfoResponse.headers.entries()))
      
      if (merchantInfoResponse.ok) {
        const merchantInfo = await merchantInfoResponse.json()
        console.log('✅ Merchant info retrieved successfully')
        console.log('Merchant ID:', merchantInfo.id)
        console.log('Merchant Name:', merchantInfo.doing_business_as?.business_name)
        console.log('Merchant Complete:', merchantInfo.complete)
        console.log('Merchant Country:', merchantInfo.country)
      } else {
        const errorText = await merchantInfoResponse.text()
        console.log('❌ Merchant info failed:', errorText)
      }
    } catch (err) {
      console.log('❌ Merchant info error:', err)
    }
    
    // Test 2: Check OAuth token validity
    console.log('\n--- TEST 2: OAuth Token Validation ---')
    try {
      const tokenResponse = await fetch('https://api.sumup.com/token', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      
      console.log('Token Info Status:', tokenResponse.status)
      if (tokenResponse.ok) {
        const tokenInfo = await tokenResponse.json()
        console.log('✅ Token info retrieved')
        console.log('Token Scopes:', tokenInfo.scope)
        console.log('Token Expires:', tokenInfo.expires_in)
      } else {
        const errorText = await tokenResponse.text()
        console.log('❌ Token info failed:', errorText)
      }
    } catch (err) {
      console.log('❌ Token info error:', err)
    }
    
    // Test 3: Try to find ANY working endpoint
    console.log('\n--- TEST 3: Endpoint Discovery ---')
    const testEndpoints = [
      `https://api.sumup.com/v2.1/merchants/${merchantCode}`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-27T00:00:00Z&newest_time=2025-09-27T23:59:59Z&limit=1000`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-26T00:00:00Z&newest_time=2025-09-26T23:59:59Z&limit=1000`
    ]
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        
        console.log(`${endpoint}: ${response.status} ${response.statusText}`)
        if (response.status === 200) {
          console.log(`✅ WORKING ENDPOINT FOUND: ${endpoint}`)
        } else if (response.status === 401) {
          console.log(`🔐 AUTH ERROR: ${endpoint}`)
        } else if (response.status === 403) {
          console.log(`🚫 PERMISSION ERROR: ${endpoint}`)
        } else if (response.status === 404) {
          console.log(`❌ NOT FOUND: ${endpoint}`)
        } else {
          console.log(`⚠️  UNKNOWN STATUS: ${endpoint}`)
        }
      } catch (err) {
        console.log(`💥 ERROR: ${endpoint} - ${err}`)
      }
    }
    
    console.log('\n--- TEST 4: Transaction History Parameter Testing ---')
    // Test transaction-history endpoint with DIFFERENT approaches
    const paramTests = [
      // Try WITHOUT any parameters first
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history`,
      // Try with just limit
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=10`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=50`,
      // Try with just order
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?order=desc`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?order=asc`,
      // Try with just statuses
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?statuses=SUCCESSFUL`,
      // Try with correct date parameters (oldest_time/newest_time)
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-27T00:00:00Z&newest_time=2025-09-27T23:59:59Z`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-26T00:00:00Z&newest_time=2025-09-26T23:59:59Z`,
      // Try with different date formats
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-27&newest_time=2025-09-27`,
      // Try with limit and date parameters
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-27T00:00:00Z&newest_time=2025-09-27T23:59:59Z&limit=1000`
    ]
    
    for (const endpoint of paramTests) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        
        console.log(`${endpoint}: ${response.status}`)
        if (response.status === 200) {
          console.log(`✅ PARAMETER TEST SUCCESS: ${endpoint}`)
          const data = await response.json()
          console.log('Response structure:', Object.keys(data))
          console.log('Response data:', JSON.stringify(data, null, 2))
        } else if (response.status === 400) {
          const errorData = await response.json()
          console.log(`⚠️  BAD REQUEST: ${endpoint}`)
          console.log('Error details:', errorData)
        }
      } catch (err) {
        console.log(`💥 PARAMETER TEST ERROR: ${endpoint} - ${err}`)
      }
    }
    
    console.log('\n=== SUMUP API DEBUG SESSION END ===\n')

    return NextResponse.json({
      message: 'Debug analysis completed - check console logs for detailed results',
      merchantCode: merchantCode,
      accessTokenLength: accessToken.length,
      debugSessionCompleted: true
    })

  } catch (error: any) {
    console.error('Debug analysis error:', error)
    return NextResponse.json({ 
      error: 'Internal server error during debug analysis',
      details: error.message
    }, { status: 500 })
  }
}
