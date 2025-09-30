import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const encryptionKey = process.env.ENCRYPTION_KEY!

interface SumUpTransaction {
  id: string
  amount: number
  currency: string
  timestamp: string
  status: string
  payment_type: string
  product_summary?: string
  transaction_code: string
  transaction_id: string
  type: string
  user: string
  card_type?: string
  entry_mode?: string
  installments_count?: number
  payout_plan?: string
  payouts_received?: number
  payouts_total?: number
  refunded_amount?: number
  client_transaction_id?: string
}

async function fetchAllSumUpTransactions(
  accessToken: string,
  merchantCode: string,
  fromDate?: string,
  toDate?: string
): Promise<SumUpTransaction[]> {
  console.log(`🔄 Fetching transactions for merchant: ${merchantCode}`)
  if (fromDate && toDate) {
    console.log(`📅 Date range: ${fromDate} to ${toDate}`)
  } else {
    console.log(`📅 Fetching all available transactions`)
  }
  
  let allTransactions: SumUpTransaction[] = []
  let nextPageUrl: string | null = null
  let pageCount = 0
  const maxPages = 100 // Safety limit to prevent infinite loops
  
  // Build initial URL with optional date parameters
  let initialUrl = `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000`
  if (fromDate && toDate) {
    // Convert dates to proper ISO format with time
    const startTime = `${fromDate}T00:00:00Z`
    const endTime = `${toDate}T23:59:59Z`
    initialUrl += `&oldest_time=${startTime}&newest_time=${endTime}`
  }
  nextPageUrl = initialUrl
  
  while (nextPageUrl && pageCount < maxPages) {
    try {
      pageCount++
      console.log(`📄 Fetching page ${pageCount}...`)
      
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        console.error(`❌ Failed to fetch page ${pageCount}: ${response.status} ${response.statusText}`)
        break
      }
      
      const data = await response.json()
      let transactions: SumUpTransaction[] = []
      
      // Handle different response structures
      if (data.items && Array.isArray(data.items)) {
        transactions = data.items
      } else if (Array.isArray(data)) {
        transactions = data
      } else if (data.transactions && Array.isArray(data.transactions)) {
        transactions = data.transactions
      }
      
      console.log(`📊 Page ${pageCount}: Found ${transactions.length} transactions`)
      allTransactions = [...allTransactions, ...transactions]
      
      // Check for next page
      if (data.links && data.links.next) {
        nextPageUrl = data.links.next
      } else {
        nextPageUrl = null
      }
      
      // If we got fewer transactions than the limit, we've reached the end
      if (transactions.length < 1000) {
        nextPageUrl = null
      }
      
    } catch (error) {
      console.error(`❌ Error fetching page ${pageCount}:`, error)
      break
    }
  }
  
  console.log(`✅ Total transactions fetched: ${allTransactions.length} across ${pageCount} pages`)
  return allTransactions
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting SumUp Data Synchronization...')
    
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header found')
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    console.log('🔑 Token received (first 20 chars):', token.substring(0, 20) + '...')
    
    let requestBody
    try {
      requestBody = await request.json()
      console.log('📝 Request body:', JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: { message: 'Invalid JSON in request body' } },
        { status: 400 }
      )
    }

    const { organizationId, fromDate, toDate } = requestBody

    if (!organizationId) {
      console.log('❌ Missing organizationId in request')
      return NextResponse.json(
        { error: { message: 'organizationId is required' } },
        { status: 400 }
      )
    }

    console.log(`📊 Sync request for organization: ${organizationId}`)
    if (fromDate && toDate) {
      console.log(`📅 Date range: ${fromDate} to ${toDate}`)
    } else {
      console.log(`📅 No date range specified - fetching all transactions`)
    }

    // Create Supabase client with service role key
    console.log('🔧 Environment check:', {
      supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
      supabaseServiceKey: supabaseServiceKey ? '✅ Set' : '❌ Missing',
      encryptionKey: encryptionKey ? '✅ Set' : '❌ Missing'
    })
    
    if (!supabaseUrl || !supabaseServiceKey || !encryptionKey) {
      console.error('❌ Missing required environment variables')
      return NextResponse.json(
        { error: { message: 'Server configuration error' } },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token and get user data
    console.log('🔍 Verifying user token...')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError) {
      console.error('❌ Authentication error:', userError)
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    if (!user) {
      console.error('❌ No user found for token')
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    console.log('✅ User authenticated:', user.email)

    // Get user data to check permissions
    console.log('🔍 Fetching user data...')
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError) {
      console.error('❌ Error fetching user data:', userDataError)
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    if (!userData) {
      console.error('❌ No user data found')
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    console.log('✅ User data found:', { role: userData.role, organization_id: userData.organization_id })

    // Check if user has permission (owner or manager)
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Check if user belongs to the requested organization
    if (userData.organization_id !== organizationId) {
      return NextResponse.json(
        { error: { message: 'Access denied to this organization' } },
        { status: 403 }
      )
    }

    // Get merchant codes for this organization with OAuth tokens
    console.log('🔍 Fetching merchant codes...')
    const { data: merchantCodes, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('merchant_code, oauth_access_token_encrypted, oauth_token_expires_at, oauth_refresh_token_encrypted, oauth_client_id, oauth_client_secret_encrypted')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (merchantError) {
      console.error('❌ Error fetching merchant codes:', merchantError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch merchant codes' } },
        { status: 500 }
      )
    }

    if (!merchantCodes || merchantCodes.length === 0) {
      console.log('⚠️ No active merchant codes found for organization:', organizationId)
      return NextResponse.json(
        { error: { message: 'No active merchant codes found for this organization' } },
        { status: 404 }
      )
    }

    console.log(`📊 Found ${merchantCodes.length} merchant codes to sync`)

    if (merchantCodes.length === 0) {
      return NextResponse.json({
        success: true,
        totalTransactionsProcessed: 0,
        newTransactionsAdded: 0,
        merchantResults: [],
        message: 'No active merchant codes found for synchronization'
      })
    }

    let totalTransactionsProcessed = 0
    let totalNewTransactions = 0
    const results = []

    // Process each merchant code
    for (const merchantCode of merchantCodes) {
      try {
        console.log(`\n🔄 Processing merchant: ${merchantCode.merchant_code}`)
        
        // Check if OAuth token is expired and refresh if needed
        let accessToken = merchantCode.oauth_access_token_encrypted
        
        if (merchantCode.oauth_token_expires_at && new Date(merchantCode.oauth_token_expires_at) <= new Date()) {
          console.log('🔄 OAuth token expired, refreshing...')
          
          if (!merchantCode.oauth_refresh_token_encrypted) {
            console.error('❌ No refresh token available for merchant:', merchantCode.merchant_code)
            continue
          }

          try {
            // Decrypt credentials (using the same logic as in get-transactions-by-date)
            const crypto = require('crypto')
            
            // Decrypt client secret
            let clientSecret: string
            try {
              const secretData = JSON.parse(merchantCode.oauth_client_secret_encrypted)
              if (secretData.encrypted && secretData.iv) {
                if (!secretData.tag || secretData.tag === '') {
                  // Use CBC decryption for empty tag
                  const encryptionKey = process.env.ENCRYPTION_KEY!
                  const keyBuffer = Buffer.from(encryptionKey, 'hex')
                  const iv = Buffer.from(secretData.iv, 'hex')
                  
                  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
                  let decrypted = decipher.update(secretData.encrypted, 'hex', 'utf8')
                  decrypted += decipher.final('utf8')
                  
                  clientSecret = decrypted
                } else {
                  // Use GCM decryption with tag
                  const encryptionKey = process.env.ENCRYPTION_KEY!
                  const keyBuffer = Buffer.from(encryptionKey, 'hex')
                  const iv = Buffer.from(secretData.iv, 'hex')
                  const tag = Buffer.from(secretData.tag, 'hex')
                  
                  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
                  decipher.setAuthTag(tag)
                  
                  let decrypted = decipher.update(secretData.encrypted, 'hex', 'utf8')
                  decrypted += decipher.final('utf8')
                  
                  clientSecret = decrypted
                }
              } else {
                clientSecret = merchantCode.oauth_client_secret_encrypted
              }
            } catch (decryptError) {
              console.error('Failed to decrypt client secret:', decryptError)
              continue
            }

            // Decrypt refresh token
            let refreshToken: string
            try {
              const tokenData = JSON.parse(merchantCode.oauth_refresh_token_encrypted)
              if (tokenData.encrypted && tokenData.iv) {
                if (!tokenData.tag || tokenData.tag === '') {
                  // Use CBC decryption for empty tag
                  const encryptionKey = process.env.ENCRYPTION_KEY!
                  const keyBuffer = Buffer.from(encryptionKey, 'hex')
                  const iv = Buffer.from(tokenData.iv, 'hex')
                  
                  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
                  let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
                  decrypted += decipher.final('utf8')
                  
                  refreshToken = decrypted
                } else {
                  // Use GCM decryption with tag
                  const encryptionKey = process.env.ENCRYPTION_KEY!
                  const keyBuffer = Buffer.from(encryptionKey, 'hex')
                  const iv = Buffer.from(tokenData.iv, 'hex')
                  const tag = Buffer.from(tokenData.tag, 'hex')
                  
                  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
                  decipher.setAuthTag(tag)
                  
                  let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
                  decrypted += decipher.final('utf8')
                  
                  refreshToken = decrypted
                }
              } else {
                refreshToken = merchantCode.oauth_refresh_token_encrypted
              }
            } catch (decryptError) {
              console.error('Failed to decrypt refresh token:', decryptError)
              continue
            }

            // Refresh the access token
            const refreshResponse = await fetch('https://api.sumup.com/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: merchantCode.oauth_client_id,
                client_secret: clientSecret,
                refresh_token: refreshToken,
              }).toString(),
            })

            if (!refreshResponse.ok) {
              const errorData = await refreshResponse.json()
              console.error('Failed to refresh OAuth token:', errorData)
              continue
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
              .eq('merchant_code', merchantCode.merchant_code)

            if (updateError) {
              console.error('Failed to update tokens in database:', updateError)
              continue
            }

            accessToken = access_token
            console.log('✅ OAuth token refreshed successfully')
          } catch (error) {
            console.error('Error refreshing OAuth token:', error)
            continue
          }
        }

        // Fetch all transactions for this merchant
        const transactions = await fetchAllSumUpTransactions(accessToken, merchantCode.merchant_code, fromDate, toDate)
        
        if (transactions.length === 0) {
          console.log(`⚠️ No transactions found for merchant: ${merchantCode.merchant_code}`)
          continue
        }

        console.log(`📊 Found ${transactions.length} transactions for merchant: ${merchantCode.merchant_code}`)

        // Check which transactions are new
        const transactionIds = transactions.map(t => t.id)
        const { data: existingTransactions } = await supabase
          .from('payment_transactions')
          .select('transaction_id')
          .in('transaction_id', transactionIds)
          .eq('organization_id', organizationId)

        const existingIds = new Set(existingTransactions?.map(t => t.transaction_id) || [])
        const newTransactions = transactions.filter(t => !existingIds.has(t.id))

        console.log(`📈 New transactions: ${newTransactions.length} out of ${transactions.length} total`)

        // Insert new transactions into database
        if (newTransactions.length > 0) {
          const transactionsToInsert = newTransactions.map(transaction => ({
            organization_id: organizationId,
            transaction_id: transaction.id,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            transaction_date: new Date(transaction.timestamp),
            raw_data: transaction,
            merchant_code: merchantCode.merchant_code
          }))

          const { error: insertError } = await supabase
            .from('payment_transactions')
            .insert(transactionsToInsert)

          if (insertError) {
            console.error('Failed to insert transactions:', insertError)
            results.push({
              merchant_code: merchantCode.merchant_code,
              total: transactions.length,
              new: 0,
              error: insertError.message
            })
          } else {
            console.log(`✅ Inserted ${newTransactions.length} new transactions for merchant: ${merchantCode.merchant_code}`)
            results.push({
              merchant_code: merchantCode.merchant_code,
              total: transactions.length,
              new: newTransactions.length,
              error: null
            })
            totalNewTransactions += newTransactions.length
          }
        } else {
          console.log(`ℹ️ No new transactions for merchant: ${merchantCode.merchant_code}`)
          results.push({
            merchant_code: merchantCode.merchant_code,
            total: transactions.length,
            new: 0,
            error: null
          })
        }

        totalTransactionsProcessed += transactions.length

      } catch (error) {
        console.error(`❌ Failed to process merchant ${merchantCode.merchant_code}:`, error)
        results.push({
          merchant_code: merchantCode.merchant_code,
          total: 0,
          new: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`\n🎉 Synchronization completed!`)
    console.log(`📊 Total transactions processed: ${totalTransactionsProcessed}`)
    console.log(`🆕 New transactions added: ${totalNewTransactions}`)

    return NextResponse.json({
      success: true,
      totalTransactionsProcessed,
      newTransactionsAdded: totalNewTransactions,
      merchantResults: results,
      message: `Successfully synced ${totalTransactionsProcessed} transactions, added ${totalNewTransactions} new ones`
    })

  } catch (error) {
    console.error('❌ SumUp sync error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: { message: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    )
  }
}
