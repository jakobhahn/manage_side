import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { merchantCode, date } = await request.json()

    if (!merchantCode || !date) {
      return NextResponse.json({ error: 'Merchant code and date are required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Retrieve OAuth tokens and credentials for the merchant
    const { data: merchantData, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('oauth_access_token_encrypted, oauth_refresh_token_encrypted, encryption_salt, oauth_token_expires_at, oauth_client_id, oauth_client_secret_encrypted')
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

    // Check if token is expired and refresh if needed
    if (merchantData.oauth_token_expires_at && new Date(merchantData.oauth_token_expires_at) <= new Date()) {
      console.log('🔄 OAuth token expired, refreshing...')
      
      if (!merchantData.oauth_refresh_token_encrypted) {
        return NextResponse.json({ 
          error: 'OAuth token expired and no refresh token available',
          message: 'Please re-authenticate with SumUp to continue.'
        }, { status: 400 })
      }

      try {
        // Check if OAuth credentials are configured in the database
        if (!merchantData.oauth_client_id || !merchantData.oauth_client_secret_encrypted) {
          console.error('SumUp OAuth credentials not configured in database')
          return NextResponse.json({ 
            error: 'SumUp OAuth credentials not configured',
            message: 'Please configure OAuth credentials in the merchant settings.'
          }, { status: 400 })
        }

        // Decrypt the client secret
        let clientSecret: string
        try {
          // Try different decryption methods
          const crypto = require('crypto')
          
          // Method 1: Try JSON format with proper encryption
          try {
            const secretData = JSON.parse(merchantData.oauth_client_secret_encrypted)
            if (secretData.encrypted && secretData.iv) {
              // Check if tag is empty or missing
              if (!secretData.tag || secretData.tag === '') {
                console.log('⚠️ Empty tag in encrypted data, trying alternative decryption...')
                // Try without tag (some encryption methods don't use tags)
                const encryptionKey = process.env.ENCRYPTION_KEY!
                const keyBuffer = Buffer.from(encryptionKey, 'hex')
                const iv = Buffer.from(secretData.iv, 'hex')
                
                // Try AES-256-CBC instead of GCM
                const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
                
                let decrypted = decipher.update(secretData.encrypted, 'hex', 'utf8')
                decrypted += decipher.final('utf8')
                
                clientSecret = decrypted
                console.log('✅ Client secret decrypted successfully (CBC format)')
              } else {
                // Normal GCM decryption with tag
                const encryptionKey = process.env.ENCRYPTION_KEY!
                const keyBuffer = Buffer.from(encryptionKey, 'hex')
                const iv = Buffer.from(secretData.iv, 'hex')
                const tag = Buffer.from(secretData.tag, 'hex')
                
                const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
                decipher.setAuthTag(tag)
                
                let decrypted = decipher.update(secretData.encrypted, 'hex', 'utf8')
                decrypted += decipher.final('utf8')
                
                clientSecret = decrypted
                console.log('✅ Client secret decrypted successfully (GCM format)')
              }
            } else {
              throw new Error('Invalid JSON format')
            }
          } catch (jsonError) {
            // Method 2: Try direct string (temporary fix for unencrypted data)
            console.log('⚠️ JSON decryption failed, trying direct string...')
            clientSecret = merchantData.oauth_client_secret_encrypted
            console.log('✅ Using client secret directly (unencrypted)')
          }
        } catch (decryptError) {
          console.error('Failed to decrypt client secret:', decryptError)
          return NextResponse.json({ 
            error: 'Failed to decrypt OAuth credentials',
            message: 'Please re-configure OAuth credentials.'
          }, { status: 400 })
        }

        // Decrypt the refresh token
        let refreshToken: string
        try {
          // Try different decryption methods
          const crypto = require('crypto')
          
          // Method 1: Try JSON format with proper encryption
          try {
            const tokenData = JSON.parse(merchantData.oauth_refresh_token_encrypted)
            if (tokenData.encrypted && tokenData.iv) {
              // Check if tag is empty or missing
              if (!tokenData.tag || tokenData.tag === '') {
                console.log('⚠️ Empty tag in refresh token, trying alternative decryption...')
                // Try without tag (some encryption methods don't use tags)
                const encryptionKey = process.env.ENCRYPTION_KEY!
                const keyBuffer = Buffer.from(encryptionKey, 'hex')
                const iv = Buffer.from(tokenData.iv, 'hex')
                
                // Try AES-256-CBC instead of GCM
                const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
                
                let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
                decrypted += decipher.final('utf8')
                
                refreshToken = decrypted
                console.log('✅ Refresh token decrypted successfully (CBC format)')
              } else {
                // Normal GCM decryption with tag
                const encryptionKey = process.env.ENCRYPTION_KEY!
                const keyBuffer = Buffer.from(encryptionKey, 'hex')
                const iv = Buffer.from(tokenData.iv, 'hex')
                const tag = Buffer.from(tokenData.tag, 'hex')
                
                const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
                decipher.setAuthTag(tag)
                
                let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
                decrypted += decipher.final('utf8')
                
                refreshToken = decrypted
                console.log('✅ Refresh token decrypted successfully (GCM format)')
              }
            } else {
              throw new Error('Invalid JSON format')
            }
          } catch (jsonError) {
            // Method 2: Try direct string (temporary fix for unencrypted data)
            console.log('⚠️ JSON decryption failed for refresh token, trying direct string...')
            refreshToken = merchantData.oauth_refresh_token_encrypted
            console.log('✅ Using refresh token directly (unencrypted)')
          }
        } catch (decryptError) {
          console.error('Failed to decrypt refresh token:', decryptError)
          return NextResponse.json({ 
            error: 'Failed to decrypt refresh token',
            message: 'Please re-authenticate with SumUp.'
          }, { status: 400 })
        }

        console.log('🔄 Attempting to refresh OAuth token...')
        console.log('Client ID (first 10 chars):', merchantData.oauth_client_id.substring(0, 10) + '...')
        console.log('Client ID length:', merchantData.oauth_client_id.length)
        console.log('Client Secret length:', clientSecret.length)
        console.log('Client Secret (first 10 chars):', clientSecret.substring(0, 10) + '...')
        console.log('Refresh Token length:', refreshToken.length)
        console.log('Refresh Token (first 10 chars):', refreshToken.substring(0, 10) + '...')

        // Refresh the access token
        const refreshParams = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: merchantData.oauth_client_id,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        })
        
        console.log('🔄 Refresh request params:')
        console.log('- grant_type: refresh_token')
        console.log('- client_id:', merchantData.oauth_client_id)
        console.log('- client_secret:', clientSecret)
        console.log('- refresh_token:', refreshToken)
        
        const refreshResponse = await fetch('https://api.sumup.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: refreshParams.toString(),
        })

        if (!refreshResponse.ok) {
          const errorData = await refreshResponse.json()
          console.error('Failed to refresh OAuth token:', errorData)
          // Don't return 401 here as it causes logout - return 400 instead
          return NextResponse.json({ 
            error: 'Failed to refresh OAuth token', 
            details: errorData,
            message: 'OAuth token refresh failed. Please re-authenticate with SumUp.'
          }, { status: 400 })
        }

        const { access_token, refresh_token: new_refresh_token, expires_in } = await refreshResponse.json()

        // Update merchant code with new tokens
        const { error: updateError } = await supabase
          .from('merchant_codes')
          .update({
            oauth_access_token_encrypted: access_token,
            oauth_refresh_token_encrypted: new_refresh_token,
            oauth_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('merchant_code', merchantCode)

        if (updateError) {
          console.error('Failed to update tokens in database:', updateError)
          return NextResponse.json({ error: 'Failed to update tokens' }, { status: 500 })
        }

        accessToken = access_token
        console.log('✅ OAuth token refreshed successfully')
      } catch (error) {
        console.error('Error refreshing OAuth token:', error)
        return NextResponse.json({ error: 'Failed to refresh OAuth token' }, { status: 500 })
      }
    }

    console.log('=== FETCHING TRANSACTIONS FOR DATE ===')
    console.log('Merchant Code:', merchantCode)
    console.log('Date:', date)
    console.log('Access Token (first 20 chars):', accessToken.substring(0, 20) + '...')

    // Create date range for the specified date
    const startDate = `${date}T00:00:00Z`
    const endDate = `${date}T23:59:59Z`

    console.log('Date Range:', startDate, 'to', endDate)

    // Since SumUp API seems to ignore date parameters, we'll fetch all transactions and filter client-side
    // Start with a broader date range to ensure we get the transactions we need
    const searchStartDate = new Date(date)
    searchStartDate.setDate(searchStartDate.getDate() - 7) // Search 7 days before
    const searchEndDate = new Date(date)
    searchEndDate.setDate(searchEndDate.getDate() + 7) // Search 7 days after
    
    const searchStartISO = searchStartDate.toISOString()
    const searchEndISO = searchEndDate.toISOString()
    
    console.log(`🔍 Searching broader date range: ${searchStartISO} to ${searchEndISO}`)
    
    const endpoints = [
      // Try with exact date range first (most efficient) - using correct parameter names
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=${startDate}&newest_time=${endDate}&limit=1000`,
      // Try with broader date range as fallback
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?oldest_time=${searchStartISO}&newest_time=${searchEndISO}&limit=1000`,
      // Try without date filter as last resort (if API ignores date parameters)
      `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000`
    ]

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`)
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })

        console.log(`Response status: ${response.status}`)

        if (response.status === 200) {
          const data = await response.json()
          console.log('✅ SUCCESS! Found transactions')
          console.log('Response structure:', Object.keys(data))
          
          let transactions = []
          
          // Handle different response structures
          if (data.items && Array.isArray(data.items)) {
            transactions = data.items
          } else if (Array.isArray(data)) {
            transactions = data
          } else if (data.transactions && Array.isArray(data.transactions)) {
            transactions = data.transactions
          }

          console.log(`Found ${transactions.length} transactions`)

          // Check if API respected the date parameters
          if (endpoint.includes('oldest_time') && endpoint.includes('newest_time')) {
            console.log('📅 API was called with date parameters - checking if they were respected...')
            if (transactions.length > 0) {
              const allTimestamps = transactions.map((t: any) => t.timestamp || t.created_at || t.date || t.time).filter(Boolean)
              const sortedTimestamps = allTimestamps.sort()
              const oldest = sortedTimestamps[0]
              const newest = sortedTimestamps[sortedTimestamps.length - 1]
              console.log(`📊 API returned data from ${oldest} to ${newest}`)
              
              // Check if the returned data is within the requested range
              const requestedStart = endpoint.includes('oldest_time=') ? endpoint.split('oldest_time=')[1].split('&')[0] : null
              const requestedEnd = endpoint.includes('newest_time=') ? endpoint.split('newest_time=')[1].split('&')[0] : null
              
              if (requestedStart && requestedEnd) {
                const withinRange = oldest >= requestedStart && newest <= requestedEnd
                console.log(`📊 API date filtering: ${withinRange ? '✅ WORKING' : '❌ IGNORED'}`)
                if (!withinRange) {
                  console.log(`📊 Requested: ${requestedStart} to ${requestedEnd}`)
                  console.log(`📊 Received: ${oldest} to ${newest}`)
                }
              }
            }
          }

          // Log first few transaction timestamps to debug date filtering
          if (transactions.length > 0) {
            console.log('📅 First 5 transaction timestamps:')
            transactions.slice(0, 5).forEach((tx: any, index: number) => {
              const timestamp = tx.timestamp || tx.created_at || tx.date || tx.time
              console.log(`  ${index + 1}. ${timestamp}`)
            })
            
            // Check if any transactions match the requested date
            const matchingDate = transactions.filter((tx: any) => {
              const timestamp = tx.timestamp || tx.created_at || tx.date || tx.time
              return timestamp && timestamp.includes(date)
            })
            console.log(`📊 Transactions matching date ${date}: ${matchingDate.length}`)
            
            // Show date range of all transactions
            const allTimestamps = transactions.map((t: any) => t.timestamp || t.created_at || t.date || t.time).filter(Boolean)
            if (allTimestamps.length > 0) {
              const sortedTimestamps = allTimestamps.sort()
              const oldest = sortedTimestamps[0]
              const newest = sortedTimestamps[sortedTimestamps.length - 1]
              console.log(`📊 Date range in API response: ${oldest} to ${newest}`)
              console.log(`📊 Total transactions in response: ${transactions.length}`)
            }
          }

          if (transactions.length > 0) {
            // Check if there are more pages (pagination)
            let allTransactions = [...transactions]
            let hasMorePages = false
            let nextPageUrl = null
            
            // Check for pagination links
            if (data.links && data.links.next) {
              hasMorePages = true
              nextPageUrl = data.links.next
              console.log('📄 Pagination detected! More pages available.')
            }
            
            // Always try to fetch more pages to get all transactions
            console.log('🔄 Fetching additional pages to ensure we get all transactions...')
            let currentPage = 1
            const maxPages = 50 // Increased limit to get more transactions
            
            while (nextPageUrl && currentPage < maxPages) {
              try {
                console.log(`📄 Fetching page ${currentPage + 1}...`)
                const nextResponse: Response = await fetch(nextPageUrl, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                })
                
                if (nextResponse.ok) {
                  const nextData = await nextResponse.json()
                  let nextTransactions = []
                  
                  if (nextData.items && Array.isArray(nextData.items)) {
                    nextTransactions = nextData.items
                  } else if (Array.isArray(nextData)) {
                    nextTransactions = nextData
                  } else if (nextData.transactions && Array.isArray(nextData.transactions)) {
                    nextTransactions = nextData.transactions
                  }
                  
                  allTransactions = [...allTransactions, ...nextTransactions]
                  console.log(`📄 Page ${currentPage + 1}: Found ${nextTransactions.length} additional transactions`)
                  
                  // Check for next page
                  if (nextData.links && nextData.links.next) {
                    nextPageUrl = nextData.links.next
                  } else {
                    nextPageUrl = null
                  }
                } else {
                  console.log(`❌ Failed to fetch page ${currentPage + 1}: ${nextResponse.status}`)
                  break
                }
                
                currentPage++
              } catch (err) {
                console.log(`❌ Error fetching page ${currentPage + 1}:`, err)
                break
              }
            }
            
            console.log(`📊 Total transactions found across all pages: ${allTransactions.length}`)

            // Filter transactions by date on client side (in case API ignores date filter)
            const filteredTransactions = allTransactions.filter((transaction: any) => {
              const timestamp = transaction.timestamp || transaction.created_at || transaction.date || transaction.time
              if (!timestamp) return false
              
              try {
                // Convert timestamp to date string for comparison
                const transactionDate = new Date(timestamp).toISOString().split('T')[0]
                const matches = transactionDate === date
                
                // Debug logging for first few transactions and any that might match
                if (allTransactions.indexOf(transaction) < 5 || matches) {
                  console.log(`🔍 Transaction ${transaction.id}: ${timestamp} → ${transactionDate} (matches ${date}: ${matches})`)
                }
                
                return matches
              } catch (error) {
                console.log(`❌ Error parsing timestamp ${timestamp}:`, error)
                return false
              }
            })
            
            console.log(`🔍 Client-side filtering: ${allTransactions.length} total → ${filteredTransactions.length} matching date ${date}`)

            // Save filtered transactions to database
            const { error: insertError } = await supabase
              .from('payment_transactions')
              .insert(
                filteredTransactions.map((transaction: any) => ({
                  transaction_id: transaction.id || transaction.transaction_id,
                  amount: transaction.amount || transaction.total_amount,
                  currency: transaction.currency || 'EUR',
                  status: transaction.status || 'completed',
                  merchant_code: merchantCode,
                  transaction_date: transaction.timestamp || transaction.created_at || transaction.date
                }))
              )

            if (insertError) {
              console.error('Error saving transactions to database:', insertError)
            } else {
              console.log(`✅ Saved ${filteredTransactions.length} transactions to database`)
            }

            return NextResponse.json({
              success: true,
              transactions: filteredTransactions,
              count: filteredTransactions.length,
              totalFetched: allTransactions.length,
              endpoint: endpoint,
              date: date,
              message: `Successfully fetched ${filteredTransactions.length} transactions for ${date} (from ${allTransactions.length} total)${hasMorePages ? ' (with pagination)' : ''}`
            })
          } else {
            console.log('No transactions found in response')
          }
        } else if (response.status === 401) {
          console.log(`🔐 Unauthorized: ${endpoint} - OAuth token might be expired`)
          const errorData = await response.text()
          console.log('Error details:', errorData)
          // Continue to next endpoint instead of failing immediately
        } else if (response.status === 400) {
          const errorData = await response.json()
          console.log(`⚠️  Bad Request: ${endpoint}`)
          console.log('Error details:', errorData)
        } else {
          console.log(`❌ Failed: ${endpoint} - Status ${response.status}`)
        }
      } catch (err) {
        console.log(`💥 Error with ${endpoint}:`, err)
      }
    }

    // If we get here, no endpoint worked
        return NextResponse.json({
          success: false,
          message: `No transactions found for ${date}. The SumUp API returned 0 transactions, but none match the requested date.`,
          date: date,
          merchantCode: merchantCode,
          triedEndpoints: endpoints.length,
          apiDataRange: null,
          suggestion: "The SumUp API seems to only return historical test data. Please check if your merchant account has current transactions or if you need to use different dates."
        })

  } catch (error: any) {
    console.error('Get transactions by date error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
