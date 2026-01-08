import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { extractItemsFromSumUpTransaction } from '../../transaction-items/extract-from-sumup'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Decrypt function for OAuth tokens
function decrypt(encryptedData: string, key: string, salt: string): string {
  try {
    const tokenData = JSON.parse(encryptedData)
    if (tokenData.encrypted && tokenData.iv) {
      const keyBuffer = Buffer.from(key, 'hex')
      const iv = Buffer.from(tokenData.iv, 'hex')
      
      if (!tokenData.tag || tokenData.tag === '') {
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
        let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
      } else {
        const tag = Buffer.from(tokenData.tag, 'hex')
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
        decipher.setAuthTag(tag)
        let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
      }
    }
    return encryptedData
  } catch (error) {
    return encryptedData
  }
}

// Encrypt function for OAuth tokens
function encrypt(data: string, key: string): string {
  const keyBuffer = Buffer.from(key, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex')
  })
}

// POST /api/sumup/sync-items - Fetch and save transaction items for existing transactions
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify the user's session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid or expired token' } },
        { status: 401 }
      )
    }

    // Get user data
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check permissions
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    const { limit, date_from, date_to } = await request.json()

    // Get merchant code with OAuth token info
    // First check if any merchant codes exist (for better error messages)
    const { data: allMerchantCodes, error: checkError } = await supabase
      .from('merchant_codes')
      .select('merchant_code, is_active, integration_type')
      .eq('organization_id', userData.organization_id)

    if (checkError) {
      console.error('Error checking merchant codes:', checkError)
      return NextResponse.json(
        { error: { message: 'Failed to check merchant codes' } },
        { status: 500 }
      )
    }

    if (!allMerchantCodes || allMerchantCodes.length === 0) {
      return NextResponse.json(
        { error: { message: 'No merchant codes found for your organization. Please add a merchant code first.' } },
        { status: 404 }
      )
    }

    // Check for active merchant codes
    const activeMerchantCodes = allMerchantCodes.filter(mc => mc.is_active)
    if (activeMerchantCodes.length === 0) {
      return NextResponse.json(
        { error: { message: 'No active merchant codes found. Please activate a merchant code first.' } },
        { status: 404 }
      )
    }

    // Get merchant code with OAuth token info
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('merchant_code, oauth_access_token_encrypted, oauth_refresh_token_encrypted, oauth_token_expires_at, oauth_client_id, oauth_client_secret_encrypted, encryption_salt')
      .eq('organization_id', userData.organization_id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (merchantError) {
      console.error('Error fetching merchant code:', merchantError)
      return NextResponse.json(
        { error: { message: `Failed to fetch merchant code: ${merchantError.message}` } },
        { status: 500 }
      )
    }

    if (!merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found or inactive' } },
        { status: 404 }
      )
    }

    // Check if OAuth is configured
    if (!merchantCode.oauth_access_token_encrypted) {
      return NextResponse.json(
        { error: { message: 'OAuth not configured for this merchant code. Please complete OAuth authentication first.' } },
        { status: 400 }
      )
    }

    // Decrypt access token
    const encryptionKey = process.env.ENCRYPTION_KEY!
    let accessToken: string
    
    try {
      accessToken = decrypt(merchantCode.oauth_access_token_encrypted, encryptionKey, merchantCode.encryption_salt || '')
    } catch (error) {
      return NextResponse.json(
        { error: { message: 'Failed to decrypt access token' } },
        { status: 500 }
      )
    }

    // Helper function to refresh token if needed (defined before use)
    const refreshTokenIfNeeded = async (): Promise<string> => {
      console.log('🔄 Attempting to refresh OAuth token...')
      
      if (!merchantCode.oauth_refresh_token_encrypted) {
        console.error('❌ No refresh token available')
        throw new Error('No refresh token available')
      }

      try {
        const refreshToken = decrypt(merchantCode.oauth_refresh_token_encrypted, encryptionKey, merchantCode.encryption_salt || '')
        console.log('✅ Refresh token decrypted successfully')
        
        let clientSecret = merchantCode.oauth_client_secret_encrypted
        
        if (clientSecret && typeof clientSecret === 'string' && clientSecret.startsWith('{')) {
          try {
            const secretObj = JSON.parse(clientSecret)
            if (secretObj.encrypted && secretObj.iv) {
              clientSecret = decrypt(secretObj.encrypted, encryptionKey, secretObj.iv)
            }
          } catch (e) {
            clientSecret = decrypt(clientSecret, encryptionKey, merchantCode.encryption_salt || '')
          }
        } else if (clientSecret) {
          clientSecret = decrypt(clientSecret, encryptionKey, merchantCode.encryption_salt || '')
        }

        const clientId = merchantCode.oauth_client_id || process.env.SUMUP_CLIENT_ID!
        console.log('🔍 Using client_id:', clientId ? `${clientId.substring(0, 10)}...` : 'NOT FOUND')
        console.log('🔍 Client secret available:', !!clientSecret)

        const refreshResponse = await fetch('https://api.sumup.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret || process.env.SUMUP_CLIENT_SECRET!,
            refresh_token: refreshToken,
          }).toString(),
        })

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text().catch(() => '')
          console.error('❌ Token refresh failed:', refreshResponse.status, errorText)
          throw new Error(`Failed to refresh token: ${refreshResponse.status} - ${errorText}`)
        }

        const tokenData = await refreshResponse.json()
        const { access_token, refresh_token: new_refresh_token, expires_in } = tokenData
        console.log('✅ Token refresh successful, expires in:', expires_in, 'seconds')

        const encryptedAccessToken = encrypt(access_token, encryptionKey)
        const encryptedRefreshToken = encrypt(new_refresh_token, encryptionKey)

        const { error: updateError } = await supabase
          .from('merchant_codes')
          .update({
            oauth_access_token_encrypted: encryptedAccessToken,
            oauth_refresh_token_encrypted: encryptedRefreshToken,
            oauth_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('merchant_code', merchantCode.merchant_code)

        if (updateError) {
          console.error('❌ Failed to update tokens in database:', updateError)
          throw new Error('Failed to update tokens in database')
        }

        console.log('✅ Token refreshed and saved to database')
        return access_token
      } catch (error) {
        console.error('❌ Error refreshing token:', error)
        throw error
      }
    }

    // Check if token is expired and refresh if needed
    // Also refresh if expires_at is null or more than 1 hour ago (to be safe)
    const tokenExpiresAt = merchantCode.oauth_token_expires_at ? new Date(merchantCode.oauth_token_expires_at) : null
    const shouldRefresh = !tokenExpiresAt || tokenExpiresAt <= new Date() || tokenExpiresAt <= new Date(Date.now() - 3600000)
    
    console.log('🔍 Token status check:', {
      expiresAt: tokenExpiresAt?.toISOString() || 'null',
      shouldRefresh,
      now: new Date().toISOString()
    })
    
    if (shouldRefresh) {
      console.log('⚠️ OAuth token expired or will expire soon, attempting to refresh...')
      console.log('   Token expires at:', tokenExpiresAt?.toISOString() || 'null')
      
      try {
        // Use the refreshTokenIfNeeded helper function
        accessToken = await refreshTokenIfNeeded()
        console.log('✅ OAuth token refreshed and encrypted successfully at start')
        console.log('   New token (first 20 chars):', accessToken.substring(0, 20) + '...')
      } catch (error) {
        console.error('❌ Error refreshing OAuth token at start:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
          { error: { message: `Failed to refresh OAuth token: ${errorMessage}. Please re-authenticate with SumUp.` } },
          { status: 401 }
        )
      }
    } else {
      console.log('✅ OAuth token is still valid, expires at:', tokenExpiresAt?.toISOString())
      console.log('   Current token (first 20 chars):', accessToken.substring(0, 20) + '...')
    }

    // Get transactions - if date range is specified, process all transactions in that range
    // Otherwise, only process transactions without items
    let query = supabase
      .from('payment_transactions')
      .select('id, transaction_id, transaction_date')
      .eq('organization_id', userData.organization_id)
      .not('transaction_id', 'is', null)
      .order('transaction_date', { ascending: false })

    if (date_from) {
      query = query.gte('transaction_date', date_from)
    }
    if (date_to) {
      query = query.lte('transaction_date', date_to)
    }
    if (limit) {
      query = query.limit(limit)
    } else {
      query = query.limit(100) // Default limit
    }

    const { data: transactions, error: transactionsError } = await query

    if (transactionsError) {
      return NextResponse.json(
        { error: { message: 'Failed to fetch transactions' } },
        { status: 500 }
      )
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No transactions found',
        processed: 0,
        items_created: 0,
        total_transactions: 0,
        transactions_with_items: 0
      })
    }

    // If date range is specified, process all transactions (including those with existing items)
    // Otherwise, only process transactions without items
    let transactionsToProcess = transactions
    let transactionsWithItemsCount = 0
    
    const transactionIds = transactions.map(t => t.id)
    const { data: existingItems } = await supabase
      .from('transaction_items')
      .select('transaction_id')
      .in('transaction_id', transactionIds)

    const transactionsWithItems = new Set(existingItems?.map(i => i.transaction_id) || [])
    transactionsWithItemsCount = transactionsWithItems.size
    
    if (!date_from && !date_to) {
      // No date range specified - only process transactions without items
      transactionsToProcess = transactions.filter(t => !transactionsWithItems.has(t.id))
      console.log(`📦 Processing ${transactionsToProcess.length} transactions without items (${transactions.length} total, ${transactionsWithItemsCount} already have items)`)
    } else {
      // Date range specified - process all transactions, but delete existing items first
      // Delete existing items for transactions in the date range to allow re-sync
      if (transactionsWithItems.size > 0) {
        const { error: deleteError } = await supabase
          .from('transaction_items')
          .delete()
          .in('transaction_id', Array.from(transactionsWithItems))
        
        if (deleteError) {
          console.error('Error deleting existing items:', deleteError)
          // Continue anyway - we'll try to insert and may get duplicates
        } else {
          console.log(`🗑️ Deleted existing items for ${transactionsWithItems.size} transactions to allow re-sync`)
        }
      }
      console.log(`📦 Processing all ${transactionsToProcess.length} transactions in date range (${transactions.length} total, ${transactionsWithItemsCount} had existing items)`)
    }

    let itemsCreated = 0
    let transactionsProcessed = 0
    let errors = 0
    const errorDetails: Array<{ transaction_id: string; error: string }> = []

    // Process transactions in batches to avoid rate limits
    const BATCH_SIZE = 5
    for (let i = 0; i < transactionsToProcess.length; i += BATCH_SIZE) {
      const batch = transactionsToProcess.slice(i, i + BATCH_SIZE)
      
      await Promise.all(batch.map(async (transaction) => {
        try {
          // Fetch transaction details from SumUp API
          const endpoint = `https://api.sumup.com/v2.1/merchants/${merchantCode.merchant_code}/transactions?id=${transaction.transaction_id}`
          
          console.log(`🔍 Fetching transaction ${transaction.transaction_id} from: ${endpoint}`)
          
          let currentAccessToken = accessToken
          let response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${currentAccessToken}`,
              'Content-Type': 'application/json',
            },
          })

          // If 401, try refreshing token and retry once
          if (response.status === 401) {
            console.log(`⚠️ 401 error for transaction ${transaction.transaction_id}, attempting token refresh...`)
            try {
              // Refresh the token
              const newToken = await refreshTokenIfNeeded()
              // Update both local and main accessToken variables
              currentAccessToken = newToken
              accessToken = newToken
              console.log(`✅ Token refreshed, retrying transaction ${transaction.transaction_id}...`)
              
              // Retry the request with the new token
              response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${newToken}`,
                  'Content-Type': 'application/json',
                },
              })
              
              console.log(`📊 Retry response status: ${response.status}`)
              
              // If still 401 after refresh, the refresh token might be invalid
              if (response.status === 401) {
                console.error(`❌ Still 401 after token refresh for transaction ${transaction.transaction_id} - refresh token may be invalid`)
                const errorText = await response.text().catch(() => '')
                errorDetails.push({ 
                  transaction_id: transaction.transaction_id, 
                  error: `HTTP 401 after token refresh: ${errorText.substring(0, 200)}` 
                })
                errors++
                return
              }
            } catch (refreshError) {
              console.error(`❌ Failed to refresh token for transaction ${transaction.transaction_id}:`, refreshError)
              const errorMsg = refreshError instanceof Error ? refreshError.message : 'Unknown error'
              errorDetails.push({ 
                transaction_id: transaction.transaction_id, 
                error: `Token refresh failed: ${errorMsg}` 
              })
              errors++
              return
            }
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            const errorMsg = `HTTP ${response.status}: ${errorText.substring(0, 200)}`
            console.error(`❌ Failed to fetch transaction ${transaction.transaction_id}: ${errorMsg}`)
            
            // If 401, token might be expired - log but continue
            if (response.status === 401) {
              console.warn(`⚠️ 401 Unauthorized for transaction ${transaction.transaction_id} - token may need refresh`)
            }
            
            errorDetails.push({ transaction_id: transaction.transaction_id, error: errorMsg })
            errors++
            return
          }

          const transactionDetails = await response.json()
          
          // Log first transaction to debug
          if (transactionsToProcess.indexOf(transaction) === 0) {
            console.log(`🔍 First transaction details:`, {
              id: transactionDetails.id,
              hasItems: !!(transactionDetails.items || transactionDetails.products || transactionDetails.line_items),
              keys: Object.keys(transactionDetails),
              sample: JSON.stringify(transactionDetails, null, 2).substring(0, 1000)
            })
          }
          
          // Extract items from transaction
          const extractedItems = extractItemsFromSumUpTransaction(transactionDetails)
          
          if (extractedItems.length > 0) {
            // Try to match products by name
            const itemsToInsert = await Promise.all(
              extractedItems.map(async (item) => {
                // Try to find product by name
                const { data: product } = await supabase
                  .from('products')
                  .select('id')
                  .eq('organization_id', userData.organization_id)
                  .ilike('name', item.product_name)
                  .limit(1)
                  .single()
                
                return {
                  organization_id: userData.organization_id,
                  transaction_id: transaction.id,
                  product_id: product?.id || null,
                  product_name: item.product_name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  total_price: item.total_price,
                  raw_data: item.raw_data || null
                }
              })
            )
            
            // Insert transaction items
            const { error: itemsInsertError } = await supabase
              .from('transaction_items')
              .insert(itemsToInsert)
            
            if (itemsInsertError) {
              console.error(`Failed to insert items for transaction ${transaction.transaction_id}:`, itemsInsertError)
              errors++
            } else {
              itemsCreated += itemsToInsert.length
              transactionsProcessed++
              console.log(`✅ Created ${itemsToInsert.length} items for transaction ${transaction.transaction_id}`)
            }
          } else {
            transactionsProcessed++
            console.log(`ℹ️ No items found in transaction ${transaction.transaction_id}`)
          }
        } catch (error) {
          console.error(`Error processing transaction ${transaction.transaction_id}:`, error)
          if (error instanceof Error) {
            console.error(`Error details: ${error.message}`, error.stack)
          }
          errors++
        }
      }))

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < transactionsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Items sync completed',
      transactions_processed: transactionsProcessed,
      items_created: itemsCreated,
      errors: errors,
      total_transactions: transactions.length,
      transactions_with_items: transactionsWithItemsCount,
      error_details: errorDetails.slice(0, 10) // Return first 10 errors for debugging
    })

  } catch (error: any) {
    console.error('Sync items error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error', details: error.message } },
      { status: 500 }
    )
  }
}

