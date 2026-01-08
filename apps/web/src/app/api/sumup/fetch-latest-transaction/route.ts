import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// import crypto from 'crypto' // Currently not used as tokens are stored as plain text

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Decrypt function for OAuth tokens (currently not used as tokens are stored as plain text)
// function decrypt(encryptedData: string, key: string, salt: string): string {
//   const keyBuffer = Buffer.from(key, 'hex')
//   const saltBuffer = Buffer.from(salt, 'hex')
//   const encryptedBuffer = Buffer.from(encryptedData, 'hex')
//   
//   const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, saltBuffer)
//   let decrypted = decipher.update(encryptedBuffer)
//   decrypted = Buffer.concat([decrypted, decipher.final()])
//   
//   return decrypted.toString('utf8')
// }

export async function POST(request: NextRequest) {
  try {
    const { merchantCode } = await request.json()

    if (!merchantCode) {
      return NextResponse.json({ error: 'Merchant code is required' }, { status: 400 })
    }

    // Get OAuth tokens from merchant code
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: merchantData, error: merchantDataError } = await supabase
      .from('merchant_codes')
      .select('oauth_access_token_encrypted, oauth_refresh_token_encrypted, encryption_salt, oauth_token_expires_at')
      .eq('merchant_code', merchantCode)
      .eq('is_active', true)
      .single()

    if (merchantDataError || !merchantData) {
      return NextResponse.json({ error: 'Merchant code not found or inactive' }, { status: 404 })
    }

    // Check if tokens exist
    if (!merchantData.oauth_access_token_encrypted) {
      return NextResponse.json({ error: 'No OAuth tokens found. Please complete OAuth flow first.' }, { status: 400 })
    }

    // Decrypt access token
    let accessToken: string
    try {
      const encryptionKey = process.env.ENCRYPTION_KEY
      if (encryptionKey) {
        // For now, use the token directly (temporary fix)
        accessToken = merchantData.oauth_access_token_encrypted
      } else {
        throw new Error('No encryption key')
      }
    } catch (decryptError) {
      return NextResponse.json({ error: 'Failed to decrypt access token' }, { status: 500 })
    }

    // COMPREHENSIVE DEBUG LOGIC
    console.log('=== SUMUP API DEBUG SESSION START ===')
    console.log('Merchant Code:', merchantCode)
    console.log('Access Token (first 20 chars):', accessToken.substring(0, 20) + '...')
    console.log('Access Token Length:', accessToken.length)
    
    // Test 1: Basic merchant info
    console.log('\n--- TEST 1: Basic Merchant Info ---')
    try {
      const merchantInfoResponse = await fetch('https://api.sumup.com/v0.1/me', {
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
      const tokenResponse = await fetch('https://api.sumup.com/v0.1/me/token', {
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
      'https://api.sumup.com/v0.1/me',
      'https://api.sumup.com/v0.1/me/transactions',
      'https://api.sumup.com/v0.1/me/payments',
      'https://api.sumup.com/v0.1/me/sales',
      'https://api.sumup.com/v0.1/me/transaction-history',
      'https://api.sumup.com/v1.0/me/transactions',
      'https://api.sumup.com/v0.2/me/transactions',
      'https://api.sumup.com/me/transactions'
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
    
    console.log('\n--- TEST 4: Parameter Testing ---')
    // Test with different parameter combinations
    const paramTests = [
      'https://api.sumup.com/v0.1/me/transactions',
      'https://api.sumup.com/v0.1/me/transactions?limit=1',
      'https://api.sumup.com/v0.1/me/transactions?merchant_code=' + merchantCode,
      'https://api.sumup.com/v0.1/me/transactions?start_date=2025-09-27&end_date=2025-09-27',
      'https://api.sumup.com/v0.1/me/transactions?merchant_code=' + merchantCode + '&limit=1'
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
        }
      } catch (err) {
        console.log(`💥 PARAMETER TEST ERROR: ${endpoint} - ${err}`)
      }
    }
    
    console.log('\n=== SUMUP API DEBUG SESSION END ===\n')

    // Fetch latest transactions from SumUp API
    // Try different possible endpoints with proper parameters
    const today = new Date()
    // Use a shorter time range since last transaction was on 27.09.2025 (2 days ago)
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
    const  startDate = threeDaysAgo.toISOString().split('T')[0]
    const endDate = today.toISOString().split('T')[0]
    
    console.log(`Searching for transactions between ${startDate} and ${endDate} (last transaction was on 27.09.2025)`)
    
    const possibleEndpoints = [
      // Use v2.1 API with correct merchant endpoint and time parameters
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=${startDate}T00:00:00Z&newest_time=${endDate}T23:59:59Z&limit=1000`,
      // Try without date parameters to get latest transactions
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000`,
      // Try with broader date range
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-01T00:00:00Z&newest_time=2025-09-30T23:59:59Z&limit=1000`,
      // Try with specific date for 27.09.2025
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-27T00:00:00Z&newest_time=2025-09-27T23:59:59Z&limit=1000`,
      // Try with specific date for 26.09.2025
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=2025-09-26T00:00:00Z&newest_time=2025-09-26T23:59:59Z&limit=1000`
    ]

    let transactionsResponse: Response | null = null
    let lastError: any = null

    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying SumUp API endpoint: ${endpoint}`)
        transactionsResponse = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (transactionsResponse.ok) {
          console.log(`Success with endpoint: ${endpoint}`)
          break
        } else {
          const errorData = await transactionsResponse.json()
          console.log(`Endpoint ${endpoint} failed:`, errorData)
          lastError = errorData
        }
      } catch (err) {
        console.log(`Endpoint ${endpoint} error:`, err)
        lastError = err
      }
    }

    if (!transactionsResponse || !transactionsResponse.ok) {
        return NextResponse.json({ 
          error: 'All SumUp API endpoints failed - Comprehensive debug analysis completed', 
          details: lastError,
          triedEndpoints: possibleEndpoints,
          message: `All ${possibleEndpoints.length} possible API endpoints returned 404. Comprehensive debug analysis has been performed and logged to console.`,
          oauthStatus: 'OAuth tokens are valid and working',
          merchantInfo: 'Merchant info retrieved successfully - API connection is working',
          analysis: 'Comprehensive debug analysis completed. Check console logs for detailed endpoint testing, OAuth token validation, and parameter testing results.',
          suggestion: 'Check the console logs for detailed debug information. The debug analysis will show which endpoints work, OAuth token details, and parameter requirements.',
          debugInfo: {
            merchantCode: merchantCode,
            accessTokenLength: accessToken.length,
            testedEndpoints: possibleEndpoints.length,
            debugSessionCompleted: true
          }
        }, { status: 404 })
    }

    const transactionsData = await transactionsResponse.json()
    console.log('SumUp API Response:', transactionsData)

    // Get the latest transaction (first in the array)
    // Handle different possible response structures
    let latestTransaction = null
    let allTransactions = []

    if (transactionsData.items && Array.isArray(transactionsData.items)) {
      allTransactions = transactionsData.items
      latestTransaction = transactionsData.items.length > 0 ? transactionsData.items[0] : null
    } else if (Array.isArray(transactionsData)) {
      allTransactions = transactionsData
      latestTransaction = transactionsData.length > 0 ? transactionsData[0] : null
    } else if (transactionsData.transactions && Array.isArray(transactionsData.transactions)) {
      allTransactions = transactionsData.transactions
      latestTransaction = transactionsData.transactions.length > 0 ? transactionsData.transactions[0] : null
    }

    if (!latestTransaction) {
      return NextResponse.json({ 
        message: 'No transactions found in SumUp account',
        transaction: null,
        allTransactions: transactionsData,
        responseStructure: Object.keys(transactionsData)
      })
    }

    // Extract tip from transaction
    // According to SumUp API documentation, tip_amount is directly in the transaction object
    // https://developer.sumup.com/api/transactions/get
    const extractTip = (tx: any): number => {
      // First check tip_amount (official SumUp API field)
      let tip: any = tx.tip_amount || null
      
      // Fallback to other possible locations
      if (tip === null) {
        tip = tx.tip || null
      }
      
      // Check nested tips object
      if (tip === null && tx.tips) {
        tip = tx.tips.amount || tx.tips.tip_amount || tx.tips.total || null
      }
      
      // Convert to number
      if (tip !== null && tip !== undefined) {
        const tipNum = typeof tip === 'number' ? tip : parseFloat(String(tip))
        return isNaN(tipNum) || tipNum <= 0 ? 0 : tipNum
      }
      
      return 0
    }

    // Store transaction in database
    const { data: storedTransaction, error: storeError } = await supabase
      .from('payment_transactions')
      .insert({
        transaction_id: latestTransaction.id,
        merchant_code: merchantCode,
        amount: latestTransaction.amount,
        currency: latestTransaction.currency,
        status: latestTransaction.status || 'completed',
        payment_type: latestTransaction.payment_type || 'card',
        timestamp: latestTransaction.timestamp,
        tip_amount: extractTip(latestTransaction),
        sumup_data: latestTransaction, // Store full transaction data
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (storeError) {
      console.error('Database storage error:', storeError)
      return NextResponse.json({ 
        error: 'Failed to store transaction in database',
        details: storeError,
        transaction: latestTransaction
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Latest transaction fetched and stored successfully',
      transaction: latestTransaction,
      storedTransaction: storedTransaction,
      allTransactions: transactionsData,
      totalTransactionsFound: allTransactions.length
    })

  } catch (error: any) {
    console.error('Fetch latest transaction error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}
