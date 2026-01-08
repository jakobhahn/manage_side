import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Decrypt function for OAuth tokens
function decrypt(encryptedData: string, key: string, _salt: string): string {
  const keyBuffer = Buffer.from(key, 'hex')
  const saltBuffer = Buffer.from(_salt, 'hex')
  const encryptedBuffer = Buffer.from(encryptedData, 'hex')
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, saltBuffer)
  let decrypted = decipher.update(encryptedBuffer)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  
  return decrypted.toString('utf8')
}

export async function POST(request: NextRequest) {
  try {
    const { merchant_code } = await request.json()
    
    if (!merchant_code) {
      return NextResponse.json(
        { error: { message: 'Merchant code is required' } },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find organization by merchant code with OAuth tokens
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('organization_id, oauth_access_token_encrypted, oauth_refresh_token_encrypted, oauth_token_salt, oauth_expires_at')
      .eq('merchant_code', merchant_code)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

    // Check if OAuth tokens exist
    if (!merchantCode.oauth_access_token_encrypted || !merchantCode.oauth_token_salt) {
      return NextResponse.json(
        { error: { message: 'OAuth not configured for this merchant code. Please complete OAuth flow first.' } },
        { status: 400 }
      )
    }

    try {
      // Decrypt OAuth access token
      const encryptionKey = process.env.ENCRYPTION_KEY!
      let accessToken = decrypt(merchantCode.oauth_access_token_encrypted, encryptionKey, merchantCode.oauth_token_salt)

      // Check if token is expired and refresh if needed
      if (merchantCode.oauth_expires_at && new Date(merchantCode.oauth_expires_at) <= new Date()) {
        console.log('OAuth token expired, refreshing...')
        
        if (!merchantCode.oauth_refresh_token_encrypted) {
          return NextResponse.json(
            { error: { message: 'OAuth token expired and no refresh token available' } },
            { status: 401 }
          )
        }

        // Decrypt refresh token
        const refreshToken = decrypt(merchantCode.oauth_refresh_token_encrypted, encryptionKey, merchantCode.oauth_token_salt)

        // Refresh the access token
        const refreshResponse = await fetch('https://api.sumup.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.SUMUP_CLIENT_ID!,
            client_secret: process.env.SUMUP_CLIENT_SECRET!,
            refresh_token: refreshToken,
          }).toString(),
        })

        if (!refreshResponse.ok) {
          const errorData = await refreshResponse.json()
          console.error('Failed to refresh OAuth token:', errorData)
          return NextResponse.json(
            { error: { message: 'Failed to refresh OAuth token' } },
            { status: 401 }
          )
        }

        const { access_token, refresh_token: new_refresh_token, expires_in } = await refreshResponse.json()

        // Encrypt and store new tokens
        const encrypt = (data: string, key: string) => {
          const keyBuffer = Buffer.from(key, 'hex')
          const salt = crypto.randomBytes(16)
          const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, salt)
          
          let encrypted = cipher.update(data, 'utf8', 'hex')
          encrypted += cipher.final('hex')
          
          return { encrypted, salt: salt.toString('hex') }
        }

        const encryptedAccessToken = encrypt(access_token, encryptionKey)
        const encryptedRefreshToken = encrypt(new_refresh_token, encryptionKey)

        // Update tokens in database
        await supabase
          .from('merchant_codes')
          .update({
            oauth_access_token_encrypted: encryptedAccessToken.encrypted,
            oauth_refresh_token_encrypted: encryptedRefreshToken.encrypted,
            oauth_token_salt: encryptedAccessToken.salt,
            oauth_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('merchant_code', merchant_code)

        accessToken = access_token
        console.log('OAuth token refreshed successfully')
      }

      // Make SumUp API call with OAuth token
      const sumupApiUrl = 'https://api.sumup.com/v0.1/me/transactions'
      
      const response = await fetch(sumupApiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('SumUp OAuth API Error:', response.status, errorText)
        return NextResponse.json(
          { error: { message: `SumUp API Error: ${response.status} - ${errorText}` } },
          { status: response.status }
        )
      }

      const transactions = await response.json()
      console.log('Fetched transactions via OAuth:', transactions.length)

      // Process and store new transactions
      let processedCount = 0
      for (const transaction of transactions) {
        // Check if transaction already exists
        const { data: existingTransaction } = await supabase
          .from('payment_transactions')
          .select('id')
          .eq('transaction_id', transaction.id)
          .single()

        if (!existingTransaction) {
          // Extract tip from transaction
          const extractTip = (tx: any): number => {
            let tip: any = tx.tip_amount || tx.tip || null
            if (tip === null && tx.tips) {
              tip = tx.tips.amount || tx.tips.tip_amount || tx.tips.total || null
            }
            if (tip !== null && tip !== undefined) {
              const tipNum = typeof tip === 'number' ? tip : parseFloat(String(tip))
              return isNaN(tipNum) || tipNum <= 0 ? 0 : tipNum
            }
            return 0
          }

          // Extract VAT from transaction
          const extractVat = (tx: any): number => {
            let vat: any = tx.vat_amount || tx.vat || null
            if (vat !== null && vat !== undefined) {
              const vatNum = typeof vat === 'number' ? vat : parseFloat(String(vat))
              return isNaN(vatNum) || vatNum <= 0 ? 0 : vatNum
            }
            return 0
          }

          // Insert new transaction
          const { error: insertError } = await supabase
            .from('payment_transactions')
            .insert({
              organization_id: merchantCode.organization_id,
              transaction_id: transaction.id,
              amount: parseFloat(transaction.amount),
              currency: transaction.currency,
              status: transaction.status || 'completed',
              merchant_code: merchant_code,
              transaction_date: new Date(transaction.timestamp),
              tip_amount: extractTip(transaction),
              vat_amount: extractVat(transaction),
              raw_data: transaction
            })

          if (insertError) {
            console.error('Failed to insert transaction:', transaction.id, insertError)
          } else {
            processedCount++
            console.log('Processed new OAuth transaction:', transaction.id)
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Fetched ${transactions.length} transactions via OAuth, processed ${processedCount} new ones`,
        totalTransactions: transactions.length,
        newTransactions: processedCount,
        transactions: transactions.slice(0, 5) // Return first 5 for preview
      })

    } catch (decryptError) {
      console.error('Failed to decrypt OAuth tokens:', decryptError)
      return NextResponse.json(
        { error: { message: 'Failed to decrypt OAuth tokens' } },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('OAuth transaction fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}





