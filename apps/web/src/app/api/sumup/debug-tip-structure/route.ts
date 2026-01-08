import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/sumup/debug-tip-structure - Debug endpoint to see transaction structure from SumUp API
export async function GET(request: NextRequest) {
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
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Get merchant codes with OAuth tokens
    const { data: merchantCodes, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('merchant_code, oauth_access_token_encrypted, oauth_token_expires_at, oauth_refresh_token_encrypted, oauth_client_id, oauth_client_secret_encrypted')
      .eq('organization_id', userData.organization_id)
      .eq('is_active', true)
      .limit(1)

    if (merchantError || !merchantCodes || merchantCodes.length === 0) {
      return NextResponse.json(
        { error: { message: 'No active merchant codes found' } },
        { status: 404 }
      )
    }

    const merchantCode = merchantCodes[0]
    
    // Decrypt access token
    const crypto = require('crypto')
    const encryptionKey = process.env.ENCRYPTION_KEY!
    
    let accessToken: string
    try {
      const tokenData = JSON.parse(merchantCode.oauth_access_token_encrypted)
      if (tokenData.encrypted && tokenData.iv) {
        if (!tokenData.tag || tokenData.tag === '') {
          const keyBuffer = Buffer.from(encryptionKey, 'hex')
          const iv = Buffer.from(tokenData.iv, 'hex')
          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
          let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          accessToken = decrypted
        } else {
          const keyBuffer = Buffer.from(encryptionKey, 'hex')
          const iv = Buffer.from(tokenData.iv, 'hex')
          const tag = Buffer.from(tokenData.tag, 'hex')
          const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
          decipher.setAuthTag(tag)
          let decrypted = decipher.update(tokenData.encrypted, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          accessToken = decrypted
        }
      } else {
        accessToken = merchantCode.oauth_access_token_encrypted
      }
    } catch (error) {
      return NextResponse.json(
        { error: { message: 'Failed to decrypt access token' } },
        { status: 500 }
      )
    }

    // Try different endpoints to see transaction structure
    const endpoints = [
      `https://api.sumup.com/v0.1/me/transactions?limit=5`,
      `https://api.sumup.com/v2.1/merchants/${merchantCode.merchant_code}/transactions/history?limit=5`,
    ]

    const results: any[] = []

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing endpoint: ${endpoint}`)
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          let transactions: any[] = []
          
          if (data.items && Array.isArray(data.items)) {
            transactions = data.items
          } else if (Array.isArray(data)) {
            transactions = data
          } else if (data.transactions && Array.isArray(data.transactions)) {
            transactions = data.transactions
          }

          if (transactions.length > 0) {
            const firstTx = transactions[0]
            results.push({
              endpoint,
              status: 'success',
              transactionCount: transactions.length,
              firstTransaction: {
                id: firstTx.id,
                keys: Object.keys(firstTx),
                hasTipAmount: 'tip_amount' in firstTx,
                hasTip: 'tip' in firstTx,
                hasTips: 'tips' in firstTx,
                tipAmount: firstTx.tip_amount,
                tip: firstTx.tip,
                tips: firstTx.tips,
                fullStructure: firstTx // Include full transaction for inspection
              }
            })
          } else {
            results.push({
              endpoint,
              status: 'success',
              transactionCount: 0,
              message: 'No transactions found'
            })
          }
        } else {
          results.push({
            endpoint,
            status: 'error',
            statusCode: response.status,
            statusText: response.statusText
          })
        }
      } catch (error: any) {
        results.push({
          endpoint,
          status: 'error',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      merchantCode: merchantCode.merchant_code,
      results
    })

  } catch (error: any) {
    console.error('Debug tip structure error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error', details: error.message } },
      { status: 500 }
    )
  }
}





