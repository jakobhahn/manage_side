import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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
        // Use CBC decryption for empty tag
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
        let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
      } else {
        // Use GCM decryption with tag
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

// POST /api/sumup/fetch-transaction-details - Fetch and optionally save transaction details
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

    const { transaction_id, merchant_code, save_to_db } = await request.json()

    if (!transaction_id) {
      return NextResponse.json(
        { error: { message: 'transaction_id is required' } },
        { status: 400 }
      )
    }

    // Get merchant code (use provided or find from organization)
    let merchantCodeToUse = merchant_code
    
    if (!merchantCodeToUse) {
      const { data: merchantCodes } = await supabase
        .from('merchant_codes')
        .select('merchant_code')
        .eq('organization_id', userData.organization_id)
        .eq('is_active', true)
        .limit(1)
        .single()
      
      if (merchantCodes) {
        merchantCodeToUse = merchantCodes.merchant_code
      }
    }

    if (!merchantCodeToUse) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

    // Get OAuth access token
    const { data: merchantCodeData, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('merchant_code, oauth_access_token_encrypted, encryption_salt')
      .eq('merchant_code', merchantCodeToUse)
      .eq('organization_id', userData.organization_id)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchantCodeData) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found or inactive' } },
        { status: 404 }
      )
    }

    // Decrypt access token
    const encryptionKey = process.env.ENCRYPTION_KEY!
    let accessToken: string
    
    try {
      accessToken = decrypt(merchantCodeData.oauth_access_token_encrypted, encryptionKey, merchantCodeData.encryption_salt || '')
    } catch (error) {
      return NextResponse.json(
        { error: { message: 'Failed to decrypt access token' } },
        { status: 500 }
      )
    }

    // Fetch transaction details from SumUp API
    // GET /v2.1/merchants/{merchant_code}/transactions?id={transaction_id}
    const endpoint = `https://api.sumup.com/v2.1/merchants/${merchantCodeToUse}/transactions?id=${transaction_id}`
    
    console.log(`🔍 Fetching transaction details from: ${endpoint}`)
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error(`❌ SumUp API error: ${response.status} - ${errorText}`)
      return NextResponse.json(
        { error: { message: `SumUp API error: ${response.status} - ${errorText}` } },
        { status: response.status }
      )
    }

    const transactionDetails = await response.json()
    
    console.log(`✅ Transaction details fetched:`, {
      id: transactionDetails.id,
      hasTipAmount: 'tip_amount' in transactionDetails,
      hasVatAmount: 'vat_amount' in transactionDetails,
      tipAmount: transactionDetails.tip_amount,
      vatAmount: transactionDetails.vat_amount,
      amount: transactionDetails.amount
    })

    // If save_to_db is true, save/update the transaction in database
    if (save_to_db) {
      // Extract tip and VAT
      const extractTip = (tx: any): number => {
        const tip = tx.tip_amount || tx.tip || 0
        const tipNum = typeof tip === 'number' ? tip : parseFloat(String(tip))
        return isNaN(tipNum) || tipNum <= 0 ? 0 : tipNum
      }

      const extractVat = (tx: any): number => {
        const vat = tx.vat_amount || tx.vat || 0
        const vatNum = typeof vat === 'number' ? vat : parseFloat(String(vat))
        return isNaN(vatNum) || vatNum <= 0 ? 0 : vatNum
      }

      const tipAmount = extractTip(transactionDetails)
      const vatAmount = extractVat(transactionDetails)

      // Check if transaction already exists
      const { data: existingTransaction } = await supabase
        .from('payment_transactions')
        .select('id')
        .eq('transaction_id', transaction_id)
        .eq('organization_id', userData.organization_id)
        .single()

      if (existingTransaction) {
        // Update existing transaction
        const { error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            amount: transactionDetails.amount || 0,
            tip_amount: tipAmount,
            vat_amount: vatAmount,
            raw_data: transactionDetails,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTransaction.id)

        if (updateError) {
          console.error('Error updating transaction:', updateError)
          return NextResponse.json(
            { error: { message: `Failed to update transaction: ${updateError.message}` } },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Transaction updated successfully',
          transaction: transactionDetails,
          saved: true,
          updated: true
        })
      } else {
        // Insert new transaction
        const { error: insertError } = await supabase
          .from('payment_transactions')
          .insert({
            organization_id: userData.organization_id,
            transaction_id: transaction_id,
            amount: transactionDetails.amount || 0,
            currency: transactionDetails.currency || 'EUR',
            status: transactionDetails.status || 'completed',
            merchant_code: merchantCodeToUse,
            transaction_date: new Date(transactionDetails.timestamp || transactionDetails.created_at || transactionDetails.date),
            tip_amount: tipAmount,
            vat_amount: vatAmount,
            raw_data: transactionDetails
          })

        if (insertError) {
          console.error('Error inserting transaction:', insertError)
          return NextResponse.json(
            { error: { message: `Failed to insert transaction: ${insertError.message}` } },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Transaction saved successfully',
          transaction: transactionDetails,
          saved: true,
          inserted: true
        })
      }
    }

    // Return transaction details without saving
    return NextResponse.json({
      success: true,
      transaction: transactionDetails,
      saved: false
    })

  } catch (error: any) {
    console.error('Fetch transaction details error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error', details: error.message } },
      { status: 500 }
    )
  }
}





