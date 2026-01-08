import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Decrypt function for API credentials
function decrypt(encryptedData: string, key: string, salt: string): string {
  const keyBuffer = Buffer.from(key, 'hex')
  const saltBuffer = Buffer.from(salt, 'hex')
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

    // Find organization by merchant code with encrypted credentials
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('organization_id, api_key_encrypted, api_secret_encrypted, encryption_salt')
      .eq('merchant_code', merchant_code)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

    // Check if we have encrypted credentials
    if (!merchantCode.api_key_encrypted || !merchantCode.api_secret_encrypted || !merchantCode.encryption_salt) {
      return NextResponse.json(
        { error: { message: 'API credentials not configured for this merchant code' } },
        { status: 400 }
      )
    }

    try {
      // Decrypt API credentials
      const encryptionKey = process.env.ENCRYPTION_KEY!
      const apiKey = decrypt(merchantCode.api_key_encrypted, encryptionKey, merchantCode.encryption_salt)
      const apiSecret = decrypt(merchantCode.api_secret_encrypted, encryptionKey, merchantCode.encryption_salt)

      console.log('Decrypted credentials for merchant:', merchant_code)

      // Make real SumUp API call to fetch transactions
      const sumupApiUrl = `https://api.sumup.com/v2.1/merchants/${merchant_code}/transactions/history?limit=1000`
      
      // Create Basic Auth header
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
      
      const response = await fetch(sumupApiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('SumUp API Error:', response.status, errorText)
        return NextResponse.json(
          { error: { message: `SumUp API Error: ${response.status} - ${errorText}` } },
          { status: response.status }
        )
      }

      const transactions = await response.json()
      console.log('Fetched transactions from SumUp:', transactions.length)

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
            console.log('Processed new transaction:', transaction.id)
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Fetched ${transactions.length} transactions, processed ${processedCount} new ones`,
        totalTransactions: transactions.length,
        newTransactions: processedCount,
        transactions: transactions.slice(0, 5) // Return first 5 for preview
      })

    } catch (decryptError) {
      console.error('Failed to decrypt credentials:', decryptError)
      return NextResponse.json(
        { error: { message: 'Failed to decrypt API credentials' } },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Live transaction fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

