import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractItemsFromSumUpTransaction } from '../../transaction-items/extract-from-sumup'

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
  tip_amount?: number
  tip?: number
  tips?: number
  vat_amount?: number
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
  
  // Try both endpoints to see which one provides tip_amount
  // First try the v0.1 endpoint which might have more details
  let initialUrl: string
  if (fromDate && toDate) {
    // Try v0.1 endpoint first (might have more fields)
    initialUrl = `https://api.sumup.com/v0.1/me/transactions?start_date=${fromDate}&end_date=${toDate}&limit=1000`
    // Fallback to v2.1 if v0.1 doesn't work
    // const startTime = `${fromDate}T00:00:00Z`
    // const endTime = `${toDate}T23:59:59Z`
    // initialUrl = `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000&oldest_time=${startTime}&newest_time=${endTime}`
  } else {
    // Try v0.1 endpoint first
    initialUrl = `https://api.sumup.com/v0.1/me/transactions?limit=1000`
    // Fallback to v2.1 if v0.1 doesn't work
    // initialUrl = `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000`
  }
  nextPageUrl = initialUrl
  
  console.log(`🔍 Using API endpoint: ${initialUrl}`)
  
  while (nextPageUrl && pageCount < maxPages) {
    try {
      pageCount++
      console.log(`📄 Fetching page ${pageCount} from: ${nextPageUrl}`)
      
      const response: Response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        // If v0.1 fails, try v2.1 as fallback (only on first page)
        if (pageCount === 1 && response.status === 404 && initialUrl.includes('/v0.1/')) {
          console.log('⚠️ v0.1 endpoint failed, trying v2.1 fallback...')
          const fallbackUrl = fromDate && toDate
            ? `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000&oldest_time=${fromDate}T00:00:00Z&newest_time=${toDate}T23:59:59Z`
            : `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history?limit=1000`
          nextPageUrl = fallbackUrl
          console.log(`🔄 Using fallback endpoint: ${fallbackUrl}`)
          continue
        }
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
      
      // Debug: Log first transaction structure to see what fields are available
      if (transactions.length > 0 && pageCount === 1) {
        const firstTx = transactions[0]
        console.log('🔍 First transaction structure:', {
          keys: Object.keys(firstTx),
          hasTipAmount: 'tip_amount' in firstTx,
          hasTip: 'tip' in firstTx,
          hasTips: 'tips' in firstTx,
          tipAmount: firstTx.tip_amount,
          tip: firstTx.tip,
          tips: firstTx.tips,
          sample: JSON.stringify(firstTx, null, 2).substring(0, 1000) // First 1000 chars
        })
      }
      
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
  
  // If we have transactions, try to fetch detailed data for first few to see if tip_amount is available
  // The history endpoint might not return all fields, so we might need to fetch individual transactions
  if (allTransactions.length > 0) {
    console.log('🔍 Checking if individual transaction endpoint provides more details...')
    try {
      // Try fetching the first transaction individually to see if it has more fields
      const firstTxId = allTransactions[0].id
      const detailUrl = `https://api.sumup.com/v0.1/me/transactions/${firstTxId}`
      const detailResponse = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (detailResponse.ok) {
        const detailData = await detailResponse.json()
        console.log('🔍 Individual transaction endpoint response:', {
          hasTipAmount: 'tip_amount' in detailData,
          keys: Object.keys(detailData),
          tipAmount: detailData.tip_amount,
          sample: JSON.stringify(detailData, null, 2).substring(0, 2000)
        })
      } else {
        console.log(`⚠️ Individual transaction endpoint returned ${detailResponse.status}`)
      }
    } catch (error) {
      console.log('⚠️ Could not test individual transaction endpoint:', error)
    }
  }
  
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
        
        // Log sample transaction structure to see what fields are available
        if (transactions.length > 0) {
          const sample = transactions[0]
          console.log('📋 ========== FULL TRANSACTION STRUCTURE ==========')
          console.log('Transaction ID:', sample.id)
          console.log('All Keys:', Object.keys(sample))
          console.log('Full JSON:', JSON.stringify(sample, null, 2))
          console.log('Has tip_amount field?', 'tip_amount' in sample)
          console.log('Has tip field?', 'tip' in sample)
          console.log('Has tips field?', 'tips' in sample)
          if ('tip_amount' in sample) {
            console.log('tip_amount value:', sample.tip_amount)
          }
          if ('tip' in sample) {
            console.log('tip value:', sample.tip)
          }
          if ('tips' in sample) {
            console.log('tips value:', sample.tips)
          }
          console.log('================================================')
        }
        
        if (transactions.length === 0) {
          console.log(`⚠️ No transactions found for merchant: ${merchantCode.merchant_code}`)
          continue
        }

        console.log(`📊 Found ${transactions.length} transactions for merchant: ${merchantCode.merchant_code}`)

        // Helper function to fetch detailed transaction data
        // The history endpoint doesn't return tip_amount, so we need to fetch individual transactions
        const fetchDetailedTransaction = async (txId: string, merchantCode: string): Promise<any> => {
          try {
            // Use the correct endpoint according to SumUp API documentation:
            // GET /v2.1/merchants/{merchant_code}/transactions?id={transaction_id}
            const endpoint = `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions?id=${txId}`
            
            const response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            })
            
            if (response.ok) {
              const data = await response.json()
              // Log first transaction to see structure
              if (txId === transactions[0]?.id) {
                console.log(`🔍 Detailed transaction response from ${endpoint}:`, {
                  keys: Object.keys(data),
                  hasTipAmount: 'tip_amount' in data,
                  hasVatAmount: 'vat_amount' in data,
                  tipAmount: data.tip_amount,
                  vatAmount: data.vat_amount,
                  amount: data.amount,
                  fullData: JSON.stringify(data, null, 2).substring(0, 3000)
                })
              }
              return data
            } else {
              // Log failed endpoint for debugging
              if (txId === transactions[0]?.id) {
                const errorText = await response.text().catch(() => '')
                console.log(`⚠️ Endpoint ${endpoint} returned ${response.status}: ${errorText}`)
              }
            }
          } catch (error) {
            console.error(`Error fetching detailed transaction ${txId}:`, error)
          }
          return null
        }

        // Fetch detailed data for all transactions (with tip_amount)
        // Process in batches to avoid rate limits
        const BATCH_SIZE = 10
        const enrichedTransactions: any[] = []
        
        console.log(`🔄 Fetching detailed transaction data for ${transactions.length} transactions...`)
        
        for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
          const batch = transactions.slice(i, i + BATCH_SIZE)
          console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(transactions.length / BATCH_SIZE)} (${batch.length} transactions)`)
          
          const batchResults = await Promise.all(
            batch.map(async (tx) => {
              const detailedTx = await fetchDetailedTransaction(tx.id, merchantCode.merchant_code)
              if (detailedTx) {
                // Merge detailed data with history data (detailed data takes precedence for tip_amount and vat_amount)
                const merged = { 
                  ...tx, 
                  ...detailedTx,
                  // Ensure tip_amount and vat_amount from detailed response are used
                  tip_amount: detailedTx.tip_amount ?? tx.tip_amount ?? 0,
                  vat_amount: detailedTx.vat_amount ?? tx.vat_amount ?? 0,
                  // Use amount from detailed response if available (more accurate)
                  amount: detailedTx.amount ?? tx.amount
                }
                // Log first merged transaction
                if (tx.id === transactions[0]?.id) {
                  console.log(`🔗 Merged transaction data:`, {
                    transaction_id: tx.id,
                    originalTipAmount: tx.tip_amount,
                    originalVatAmount: tx.vat_amount,
                    detailedTipAmount: detailedTx.tip_amount,
                    detailedVatAmount: detailedTx.vat_amount,
                    mergedTipAmount: merged.tip_amount,
                    mergedVatAmount: merged.vat_amount,
                    mergedAmount: merged.amount
                  })
                }
                return merged
              }
              console.log(`⚠️ No detailed data found for transaction ${tx.id}`)
              return tx
            })
          )
          
          enrichedTransactions.push(...batchResults)
          
          // Small delay between batches to avoid rate limits
          if (i + BATCH_SIZE < transactions.length) {
            await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
          }
        }
        
        console.log(`✅ Enriched ${enrichedTransactions.length} transactions with detailed data`)
        
        // Use enriched transactions instead of original transactions
        const transactionsWithDetails = enrichedTransactions

        // Bereite alle Transaktionen für UPSERT vor (Update oder Insert)
        // So werden auch bestehende Transaktionen aktualisiert, falls sich Daten geändert haben
        console.log(`📈 Processing ${transactionsWithDetails.length} transactions (will update existing or insert new)`)

        // Helper function to extract refunded amount from transaction
        const extractRefundedAmount = (tx: any): number => {
          // Check refunded_amount field
          let refunded: any = tx.refunded_amount || null
          
          // Check if transaction is refunded or cancelled
          if (refunded === null) {
            // Check status for refund indicators
            const status = (tx.status || '').toUpperCase()
            if (status.includes('REFUND') || status.includes('CANCELLED') || status.includes('VOID')) {
              // If fully refunded/cancelled, refunded amount equals transaction amount
              refunded = tx.amount || 0
            }
          }
          
          // Convert to number
          if (refunded !== null && refunded !== undefined) {
            const refundedNum = typeof refunded === 'number' ? refunded : parseFloat(String(refunded))
            return isNaN(refundedNum) || refundedNum < 0 ? 0 : refundedNum
          }
          
          return 0
        }

        // Helper function to determine net amount (amount - refunded)
        const calculateNetAmount = (tx: any): number => {
          const amount = parseFloat(tx.amount || tx.total_amount || 0)
          const refunded = extractRefundedAmount(tx)
          return Math.max(0, amount - refunded) // Net amount can't be negative
        }

        // Helper function to determine correct status
        const determineStatus = (tx: any): string => {
          const status = (tx.status || 'completed').toUpperCase()
          const refunded = extractRefundedAmount(tx)
          const amount = parseFloat(tx.amount || tx.total_amount || 0)
          
          // If fully refunded, status should reflect that
          if (refunded >= amount && amount > 0) {
            return 'REFUNDED'
          }
          
          // If partially refunded
          if (refunded > 0 && refunded < amount) {
            return 'PARTIALLY_REFUNDED'
          }
          
          // If cancelled/void
          if (status.includes('CANCELLED') || status.includes('VOID')) {
            return 'CANCELLED'
          }
          
          // Default to SUCCESSFUL if transaction was successful
          if (status.includes('SUCCESS') || status.includes('COMPLETED') || status === 'PAID') {
            return 'SUCCESSFUL'
          }
          
          return status
        }

        // Helper function to extract tip from transaction
        // According to SumUp API documentation, tip_amount is directly in the transaction object
        // https://developer.sumup.com/api/transactions/get
        const extractTip = (tx: any): number => {
          // Check all possible locations for tip
          let tip: any = null
          
          // First check tip_amount (official SumUp API field)
          tip = tx.tip_amount || null
          
          // Fallback to other possible locations
          if (tip === null) {
            tip = tx.tip || null
          }
          
          // Check nested tips object
          if (tip === null && tx.tips) {
            tip = tx.tips.amount || tx.tips.tip_amount || tx.tips.total || null
          }
          
          // Check transaction_data object (if exists)
          if (tip === null && tx.transaction_data) {
            tip = tx.transaction_data.tip_amount || tx.transaction_data.tip || null
          }
          
          // Check receipt_data object (if exists)
          if (tip === null && tx.receipt_data) {
            tip = tx.receipt_data.tip_amount || tx.receipt_data.tip || null
          }
          
          // Convert to number
          if (tip !== null && tip !== undefined) {
            const tipNum = typeof tip === 'number' ? tip : parseFloat(String(tip))
            return isNaN(tipNum) || tipNum <= 0 ? 0 : tipNum
          }
          
          return 0
        }

        // Helper function to extract VAT from transaction
        const extractVat = (tx: any): number => {
          // Check all possible locations for VAT
          let vat: any = null
          
          // First check vat_amount (official SumUp API field)
          vat = tx.vat_amount || null
          
          // Fallback to other possible locations
          if (vat === null) {
            vat = tx.vat || null
          }
          
          // Check transaction_data object (if exists)
          if (vat === null && tx.transaction_data) {
            vat = tx.transaction_data.vat_amount || tx.transaction_data.vat || null
          }
          
          // Check receipt_data object (if exists)
          if (vat === null && tx.receipt_data) {
            vat = tx.receipt_data.vat_amount || tx.receipt_data.vat || null
          }
          
          // Convert to number
          if (vat !== null && vat !== undefined) {
            const vatNum = typeof vat === 'number' ? vat : parseFloat(String(vat))
            return isNaN(vatNum) || vatNum <= 0 ? 0 : vatNum
          }
          
          return 0
        }

        // Helper function to extract VAT breakdown (7% and 19%) from transaction
        const extractVatBreakdown = (tx: any): { vat7: number; vat19: number } => {
          let vat7 = 0
          let vat19 = 0
          
          // Check for direct fields
          if (tx.vat_7 !== null && tx.vat_7 !== undefined) {
            vat7 = typeof tx.vat_7 === 'number' ? tx.vat_7 : parseFloat(String(tx.vat_7)) || 0
          }
          if (tx.vat_19 !== null && tx.vat_19 !== undefined) {
            vat19 = typeof tx.vat_19 === 'number' ? tx.vat_19 : parseFloat(String(tx.vat_19)) || 0
          }
          
          // Check receipt_data object for VAT breakdown
          if (tx.receipt_data) {
            if (tx.receipt_data.vat_7 !== null && tx.receipt_data.vat_7 !== undefined) {
              vat7 = typeof tx.receipt_data.vat_7 === 'number' ? tx.receipt_data.vat_7 : parseFloat(String(tx.receipt_data.vat_7)) || 0
            }
            if (tx.receipt_data.vat_19 !== null && tx.receipt_data.vat_19 !== undefined) {
              vat19 = typeof tx.receipt_data.vat_19 === 'number' ? tx.receipt_data.vat_19 : parseFloat(String(tx.receipt_data.vat_19)) || 0
            }
            
            // Check for tax breakdown array
            if (tx.receipt_data.tax_breakdown && Array.isArray(tx.receipt_data.tax_breakdown)) {
              for (const tax of tx.receipt_data.tax_breakdown) {
                const rate = tax.rate || tax.tax_rate || 0
                const amount = tax.amount || tax.tax_amount || 0
                if (Math.abs(rate - 7.0) < 1.0) {
                  vat7 = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0
                } else if (Math.abs(rate - 19.0) < 1.0) {
                  vat19 = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0
                }
              }
            }
          }
          
          // Check transaction_data object
          if (tx.transaction_data) {
            if (tx.transaction_data.vat_7 !== null && tx.transaction_data.vat_7 !== undefined) {
              vat7 = typeof tx.transaction_data.vat_7 === 'number' ? tx.transaction_data.vat_7 : parseFloat(String(tx.transaction_data.vat_7)) || 0
            }
            if (tx.transaction_data.vat_19 !== null && tx.transaction_data.vat_19 !== undefined) {
              vat19 = typeof tx.transaction_data.vat_19 === 'number' ? tx.transaction_data.vat_19 : parseFloat(String(tx.transaction_data.vat_19)) || 0
            }
          }
          
          return { vat7: Math.max(0, vat7), vat19: Math.max(0, vat19) }
        }

        // UPSERT alle Transaktionen (Update oder Insert)
        // So werden auch bestehende Transaktionen aktualisiert, falls sich Daten geändert haben
        const transactionsToUpsert = transactionsWithDetails.map((transaction, index) => {
          const tipAmount = extractTip(transaction)
          const vatAmount = extractVat(transaction)
          const vatBreakdown = extractVatBreakdown(transaction)
          const refundedAmount = extractRefundedAmount(transaction)
          const netAmount = calculateNetAmount(transaction)
          const finalStatus = determineStatus(transaction)
          
          // Log first transaction being processed
          if (index === 0) {
            console.log('💾 Preparing to upsert transaction:', {
              transaction_id: transaction.id,
              amount: transaction.amount,
              refunded_amount: refundedAmount,
              net_amount: netAmount,
              status: finalStatus,
              tip_amount: tipAmount,
              vat_amount: vatAmount,
              transaction_keys: Object.keys(transaction)
            })
          }
          
          // Ensure organization_id is always set
          if (!organizationId) {
            console.error('❌ organizationId is missing! Cannot proceed with transaction:', transaction.id)
            throw new Error('organizationId is required for all transactions')
          }
          
          return {
            organization_id: organizationId, // Always set organization_id
            transaction_id: transaction.id,
            amount: transaction.amount || transaction.total_amount || 0,
            refunded_amount: refundedAmount,
            net_amount: netAmount,
            currency: transaction.currency || 'EUR',
            status: finalStatus,
            transaction_date: new Date(transaction.timestamp || transaction.created_at || transaction.date),
            tip_amount: tipAmount,
            vat_amount: vatAmount,
            vat_7: vatBreakdown.vat7,
            vat_19: vatBreakdown.vat19,
            raw_data: transaction,
            merchant_code: merchantCode.merchant_code,
            updated_at: new Date().toISOString() // Always update timestamp
          }
        })

        // First, clean up any duplicate entries without organization_id for these transaction_ids
        // This prevents issues with UNIQUE constraint when organization_id is NULL
        const transactionIds = transactionsToUpsert.map(tx => String(tx.transaction_id)) // Ensure string type
        console.log(`🔍 Checking for existing transactions: ${transactionIds.length} transaction IDs to check`)
        console.log(`🔍 Transaction IDs to check:`, transactionIds)
        
        // Check for orphaned transactions (without organization_id) first
        const { data: orphanedTransactions, error: orphanCheckError } = await supabase
          .from('payment_transactions')
          .select('transaction_id')
          .is('organization_id', null)
          .in('transaction_id', transactionIds)
        
        const orphanedCount = orphanedTransactions?.length || 0
        if (orphanedCount > 0) {
          console.log(`🔍 Found ${orphanedCount} orphaned transactions (without organization_id) that will be cleaned up`)
        }
        
        // Delete any entries without organization_id for these transaction_ids
        // This prevents duplicates and ensures clean data
        const { error: cleanupError } = await supabase
          .from('payment_transactions')
          .delete()
          .is('organization_id', null)
          .in('transaction_id', transactionIds)
        
        if (cleanupError) {
          console.warn('⚠️ Error cleaning up orphaned transactions:', cleanupError)
        } else if (orphanedCount > 0) {
          console.log(`🧹 Cleaned up ${orphanedCount} orphaned transactions (without organization_id)`)
        }
        
        // Check which transactions already exist for this organization
        const { data: existingTransactions, error: checkError } = await supabase
          .from('payment_transactions')
          .select('transaction_id')
          .eq('organization_id', organizationId)
          .in('transaction_id', transactionIds)

        if (checkError) {
          console.error('⚠️ Error checking existing transactions:', checkError)
          console.log('⚠️ Will treat all transactions as potentially new due to check error')
        } else {
          console.log(`📊 Found ${existingTransactions?.length || 0} existing transactions out of ${transactionIds.length} checked`)
          if (existingTransactions && existingTransactions.length > 0) {
            console.log(`📋 Existing transaction IDs:`, existingTransactions.map(tx => tx.transaction_id))
          }
        }

        const existingTransactionIds = new Set(
          (existingTransactions || []).map(tx => String(tx.transaction_id)) // Ensure string type
        )

        // UPSERT: Update existing or insert new
        console.log(`💾 Attempting to upsert ${transactionsToUpsert.length} transactions...`)
        console.log(`💾 First transaction sample:`, {
          organization_id: transactionsToUpsert[0]?.organization_id,
          transaction_id: transactionsToUpsert[0]?.transaction_id,
          amount: transactionsToUpsert[0]?.amount,
          status: transactionsToUpsert[0]?.status
        })
        
        const { data: upsertedTransactions, error: upsertError } = await supabase
          .from('payment_transactions')
          .upsert(transactionsToUpsert, {
            onConflict: 'organization_id,transaction_id',
            ignoreDuplicates: false
          })
          .select('id, transaction_id, organization_id, created_at, updated_at')

        if (upsertError) {
          console.error('❌ Failed to upsert transactions:', upsertError)
          console.error('❌ Upsert error details:', JSON.stringify(upsertError, null, 2))
          console.error('❌ Error code:', upsertError.code)
          console.error('❌ Error hint:', upsertError.hint)
          console.error('❌ Error details:', upsertError.details)
          
          // Check if error is related to missing columns
          if (upsertError.message?.includes('column') || upsertError.message?.includes('does not exist')) {
            console.error('❌ CRITICAL: Database schema mismatch! Please run migration 031_add_refunded_amount_to_payment_transactions.sql')
          }
          
          results.push({
            merchant_code: merchantCode.merchant_code,
            total: transactions.length,
            new: 0,
            updated: 0,
            error: upsertError.message
          })
          continue // Skip to next merchant
        } else {
          console.log(`✅ Upsert completed. Returned ${upsertedTransactions?.length || 0} transactions`)
          if (upsertedTransactions && upsertedTransactions.length > 0) {
            console.log(`✅ First upserted transaction sample:`, {
              id: upsertedTransactions[0].id,
              transaction_id: upsertedTransactions[0].transaction_id,
              organization_id: upsertedTransactions[0].organization_id,
              created_at: upsertedTransactions[0].created_at,
              updated_at: upsertedTransactions[0].updated_at
            })
          } else {
            console.warn('⚠️ WARNING: Upsert returned no data! This might indicate a problem.')
          }
          // Count new vs updated transactions
          // Simple logic: if it was in existingTransactionIds before the upsert, it's an update
          // Otherwise, it's new (either truly new, or was orphaned without organization_id and is now being added)
          let newCount = 0
          let updatedCount = 0
          let orphanedToNewCount = 0
          
          transactionsToUpsert.forEach(tx => {
            const txId = String(tx.transaction_id)
            const exists = existingTransactionIds.has(txId)
            const wasOrphaned = orphanedTransactions?.some(ot => ot.transaction_id === txId) || false
            
            if (exists) {
              updatedCount++
              console.log(`  Transaction ${txId}: EXISTS (updated) - was already in database for this organization`)
            } else {
              newCount++
              if (wasOrphaned) {
                orphanedToNewCount++
                console.log(`  Transaction ${txId}: NEW (was orphaned, now has organization_id)`)
              } else {
                console.log(`  Transaction ${txId}: NEW - not found in database`)
              }
            }
          })
          
          if (orphanedToNewCount > 0) {
            console.log(`✅ Upserted ${transactionsToUpsert.length} transactions for merchant: ${merchantCode.merchant_code} (${newCount} new, ${updatedCount} updated, ${orphanedToNewCount} were orphaned and now have organization_id)`)
          } else {
            console.log(`✅ Upserted ${transactionsToUpsert.length} transactions for merchant: ${merchantCode.merchant_code} (${newCount} new, ${updatedCount} updated)`)
          }
          
          // Extract and insert transaction items for all transactions
          // We need to fetch detailed transaction data from SumUp API to get items
          let totalItemsExtracted = 0
          if (upsertedTransactions && upsertedTransactions.length > 0) {
              // Process in batches to avoid rate limits
              const BATCH_SIZE = 5
              for (let i = 0; i < upsertedTransactions.length; i += BATCH_SIZE) {
                const batch = upsertedTransactions.slice(i, i + BATCH_SIZE)
                
                await Promise.all(batch.map(async (upsertedTx) => {
                  try {
                    // Fetch detailed transaction data from SumUp API to get items
                    const detailEndpoint = `https://api.sumup.com/v2.1/merchants/${merchantCode.merchant_code}/transactions?id=${upsertedTx.transaction_id}`
                    
                    const detailResponse = await fetch(detailEndpoint, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                      },
                    })

                    if (!detailResponse.ok) {
                      console.warn(`⚠️ Could not fetch details for transaction ${upsertedTx.transaction_id}: ${detailResponse.status}`)
                      return
                    }

                    const transactionDetails = await detailResponse.json()
                    
                    // Extract items from detailed transaction data
                    const extractedItems = extractItemsFromSumUpTransaction(transactionDetails)
                    
                    if (extractedItems.length > 0) {
                      // Delete existing items for this transaction to allow re-sync
                      await supabase
                        .from('transaction_items')
                        .delete()
                        .eq('transaction_id', upsertedTx.id)
                      
                      // Try to match products by name
                      const itemsToInsert = await Promise.all(
                        extractedItems.map(async (item) => {
                          // Try to find product by name
                          const { data: product } = await supabase
                            .from('products')
                            .select('id')
                            .eq('organization_id', organizationId)
                            .ilike('name', item.product_name)
                            .limit(1)
                            .single()
                          
                          return {
                            organization_id: organizationId,
                            transaction_id: upsertedTx.id,
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
                        console.error(`Failed to insert transaction items for transaction ${upsertedTx.transaction_id}:`, itemsInsertError)
                      } else {
                        totalItemsExtracted += extractedItems.length
                        console.log(`✅ Extracted ${extractedItems.length} items from transaction ${upsertedTx.transaction_id}`)
                      }
                    }
                  } catch (error) {
                    console.error(`Error fetching items for transaction ${upsertedTx.transaction_id}:`, error)
                  }
                }))

                // Small delay between batches to avoid rate limits
                if (i + BATCH_SIZE < upsertedTransactions.length) {
                  await new Promise(resolve => setTimeout(resolve, 1000))
                }
              }
            }
            
          results.push({
            merchant_code: merchantCode.merchant_code,
            total: transactions.length,
            new: newCount,
            updated: updatedCount,
            itemsExtracted: totalItemsExtracted,
            error: null
          })
          totalNewTransactions += newCount
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
