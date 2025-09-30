import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

// Decryption function
function decrypt(encrypted: string, iv: string): string {
  try {
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'))
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt token')
  }
}

// Encryption function
function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return {
    encrypted,
    iv: iv.toString('hex')
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Token refresh request received')
    
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization header')
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user session
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('Invalid session:', userError)
      return NextResponse.json(
        { error: { message: 'Invalid session' } },
        { status: 401 }
      )
    }

    console.log('🔍 Refresh token request for user:', user.id, user.email)

    // Get user data to check role and organization - use auth_id like in merchant-codes route
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    console.log('🔍 Users table query result:', { userData, userDataError })

    if (userData) {
      console.log('✅ Found user data in users table:', userData)
    }

    if (userDataError || !userData) {
      console.error('User data not found:', userDataError)
      return NextResponse.json(
        { error: { message: 'User not found. Please create an organization first by going to /register' } },
        { status: 404 }
      )
    }

    let requestBody
    try {
      requestBody = await request.json()
      console.log('🔍 Request body:', requestBody)
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: { message: 'Invalid JSON in request body' } },
        { status: 400 }
      )
    }

    const { merchantCode } = requestBody
    if (!merchantCode) {
      console.error('❌ No merchant code in request:', requestBody)
      return NextResponse.json(
        { error: { message: 'Merchant code required' } },
        { status: 400 }
      )
    }

    console.log('🔍 Processing refresh for merchant code:', merchantCode)

    // Get merchant code with OAuth tokens
    const { data: merchant, error: merchantError } = await supabase
      .from('merchant_codes')
      .select(`
        id,
        merchant_code,
        oauth_client_id,
        oauth_client_secret_encrypted,
        oauth_refresh_token_encrypted,
        oauth_token_expires_at,
        integration_type
      `)
      .eq('organization_id', userData.organization_id)
      .eq('merchant_code', merchantCode)
      .eq('integration_type', 'oauth')
      .single()

    console.log('🔍 Merchant query result:', { merchant, merchantError, merchantCode, organizationId: userData.organization_id })

    if (merchantError || !merchant) {
      console.error('❌ Merchant not found:', { merchantError, merchantCode, organizationId: userData.organization_id })
      return NextResponse.json(
        { error: { message: `Merchant code '${merchantCode}' not found or not OAuth type` } },
        { status: 404 }
      )
    }

    if (!merchant.oauth_refresh_token_encrypted) {
      return NextResponse.json(
        { error: { message: 'No refresh token available' } },
        { status: 400 }
      )
    }

    console.log('🔍 Merchant data for refresh:', {
      merchant_code: merchant.merchant_code,
      oauth_client_id: merchant.oauth_client_id,
      oauth_client_id_length: merchant.oauth_client_id?.length,
      oauth_refresh_token_encrypted: merchant.oauth_refresh_token_encrypted ? 'EXISTS' : 'NULL',
      oauth_client_secret_encrypted: merchant.oauth_client_secret_encrypted ? 'EXISTS' : 'NULL',
      refresh_token_format: merchant.oauth_refresh_token_encrypted?.includes(':') ? 'encrypted:iv' : 'plain_text'
    })

    const clientId = merchant.oauth_client_id

    // Decrypt refresh token and client credentials
    let refreshToken
    let clientSecret
    
    try {
      // Try to decrypt refresh token
      const refreshTokenParts = merchant.oauth_refresh_token_encrypted.split(':')
      if (refreshTokenParts.length === 2) {
        refreshToken = decrypt(refreshTokenParts[0], refreshTokenParts[1])
      } else {
        // If not in encrypted format, assume it's plain text (for testing)
        refreshToken = merchant.oauth_refresh_token_encrypted
        console.log('⚠️ Using plain text refresh token (not encrypted)')
      }

      // Try to decrypt client secret
      console.log('🔍 Client secret format:', merchant.oauth_client_secret_encrypted?.substring(0, 50) + '...')
      
      if (merchant.oauth_client_secret_encrypted.includes(':')) {
        // Format: encrypted:iv
        const clientSecretParts = merchant.oauth_client_secret_encrypted.split(':')
        if (clientSecretParts.length === 2) {
          clientSecret = decrypt(clientSecretParts[0], clientSecretParts[1])
          console.log('✅ Decrypted client secret (encrypted:iv format)')
        } else {
          clientSecret = merchant.oauth_client_secret_encrypted
          console.log('⚠️ Using plain text client secret (colon format)')
        }
      } else if (merchant.oauth_client_secret_encrypted.startsWith('{')) {
        // Format: JSON object - parse and decrypt it
        try {
          const secretObj = JSON.parse(merchant.oauth_client_secret_encrypted)
          console.log('🔍 Parsed client secret JSON:', { 
            hasEncrypted: !!secretObj.encrypted, 
            hasIv: !!secretObj.iv,
            hasTag: !!secretObj.tag
          })
          
          if (secretObj.encrypted && secretObj.iv) {
            clientSecret = decrypt(secretObj.encrypted, secretObj.iv)
            console.log('✅ Decrypted client secret from JSON format')
          } else {
            console.error('❌ Invalid JSON format for client secret')
            return NextResponse.json(
              { error: { message: 'Invalid JSON format for client secret' } },
              { status: 400 }
            )
          }
        } catch (parseError) {
          console.error('❌ Failed to parse client secret JSON:', parseError)
          return NextResponse.json(
            { error: { message: 'Failed to parse client secret JSON' } },
            { status: 400 }
          )
        }
      } else {
        // Plain text
        clientSecret = merchant.oauth_client_secret_encrypted
        console.log('⚠️ Using plain text client secret')
      }
    } catch (error) {
      console.error('Decryption error:', error)
      return NextResponse.json(
        { error: { message: 'Failed to decrypt credentials' } },
        { status: 400 }
      )
    }

    console.log('🔍 Decrypted credentials:', {
      clientId: clientId,
      clientSecret: clientSecret ? 'EXISTS' : 'NULL',
      refreshToken: refreshToken ? 'EXISTS' : 'NULL',
      clientIdLength: clientId?.length,
      clientSecretLength: clientSecret?.length,
      refreshTokenLength: refreshToken?.length
    })

    // Refresh the token with SumUp Connect API
    // Handle client secret - if it's still a JSON object, parse and decrypt it
    let finalClientSecret = clientSecret
    if (typeof clientSecret === 'string' && clientSecret.startsWith('{')) {
      try {
        const secretObj = JSON.parse(clientSecret)
        if (secretObj.encrypted && secretObj.iv) {
          finalClientSecret = decrypt(secretObj.encrypted, secretObj.iv)
          console.log('✅ Final client secret decrypted from JSON')
        }
      } catch (error) {
        console.error('❌ Failed to parse client secret in request body:', error)
      }
    }

    const sumupRequestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: finalClientSecret,
    })

    console.log('🔍 SumUp API request:', {
      url: 'https://api.sumup.com/token',
      body: sumupRequestBody.toString(),
      clientId: clientId,
      refreshToken: refreshToken ? 'EXISTS' : 'NULL'
    })
    
    console.log('🔍 Full request body:', sumupRequestBody.toString())
    
    // Log to file for debugging
    const fs = require('fs')
    const requestLog = {
      timestamp: new Date().toISOString(),
      url: 'https://api.sumup.com/token',
      body: sumupRequestBody.toString(),
      clientId: clientId,
      refreshToken: refreshToken ? 'EXISTS' : 'NULL'
    }
    fs.writeFileSync('/tmp/sumup_request.log', JSON.stringify(requestLog, null, 2))

    const tokenResponse = await fetch('https://api.sumup.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: sumupRequestBody,
    })

    if (!tokenResponse.ok) {
      let errorData
      try {
        errorData = await tokenResponse.json()
      } catch (parseError) {
        const responseText = await tokenResponse.text()
        console.error('❌ SumUp API error (non-JSON):', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          responseText
        })
        return NextResponse.json(
          { error: { message: `SumUp API error: ${responseText || 'Unknown error'}` } },
          { status: 400 }
        )
      }
      
      console.error('❌ SumUp API error:')
      console.error('Status:', tokenResponse.status)
      console.error('Status Text:', tokenResponse.statusText)
      console.error('Error Data:', errorData)
      console.error('URL:', 'https://api.sumup.com/connect/token')
      console.error('Full Error:', JSON.stringify(errorData, null, 2))
      
      // Also log to a file for debugging
      const fs = require('fs')
      const logData = {
        timestamp: new Date().toISOString(),
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorData,
        url: 'https://api.sumup.com/token'
      }
      fs.writeFileSync('/tmp/sumup_error.log', JSON.stringify(logData, null, 2))
      
      const errorMessage = errorData.error || errorData.error_description || errorData.message || JSON.stringify(errorData) || 'Unknown error'
      return NextResponse.json(
        { error: { message: `SumUp API error: ${errorMessage}` } },
        { status: 400 }
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token refreshed successfully for merchant:', merchantCode)

    // Encrypt new tokens
    const encryptedAccessToken = encrypt(tokenData.access_token)
    const encryptedRefreshToken = encrypt(tokenData.refresh_token || refreshToken)

    // Calculate new expiration time
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

    // Update merchant code with new tokens
    const { error: updateError } = await supabase
      .from('merchant_codes')
      .update({
        oauth_access_token_encrypted: `${encryptedAccessToken.encrypted}:${encryptedAccessToken.iv}`,
        oauth_refresh_token_encrypted: `${encryptedRefreshToken.encrypted}:${encryptedRefreshToken.iv}`,
        oauth_token_expires_at: expiresAt.toISOString(),
        last_sync_at: new Date().toISOString()
      })
      .eq('id', merchant.id)

    if (updateError) {
      console.error('Failed to update tokens in database:', updateError)
      return NextResponse.json(
        { error: { message: 'Failed to save refreshed tokens' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      expires_at: expiresAt.toISOString(),
      expires_in: tokenData.expires_in
    })

  } catch (error) {
    console.error('❌ Token refresh error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Full error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      error
    })
    return NextResponse.json(
      { error: { message: `Internal server error: ${errorMessage}` } },
      { status: 500 }
    )
  }
}
