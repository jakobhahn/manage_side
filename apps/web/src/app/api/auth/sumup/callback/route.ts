import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Decrypt function for OAuth client secret
function decrypt(encryptedData: string, key: string, salt: string): string {
  const keyBuffer = Buffer.from(key, 'hex')
  const saltBuffer = Buffer.from(salt, 'hex')
  const encryptedBuffer = Buffer.from(encryptedData, 'hex')
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, saltBuffer)
  let decrypted = decipher.update(encryptedBuffer)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  
  return decrypted.toString('utf8')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      console.error('SumUp OAuth Error:', error, errorDescription)
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/sumup?error=${error}&error_description=${errorDescription}`)
    }

    if (!code) {
      console.error('SumUp OAuth: No authorization code received')
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/sumup?error=no_code&error_description=No authorization code received`)
    }

    if (!state) {
      console.error('SumUp OAuth: No state parameter received')
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/sumup?error=no_state&error_description=No state parameter received`)
    }

    // Parse state to get organization_id and merchant_code
    let organizationId: string | undefined
    let merchantCode: string
    
    try {
      // Try to parse as base64-encoded JSON first
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'))
        organizationId = stateData.organization_id
        merchantCode = stateData.merchant_code
        console.log('Successfully parsed base64 state:', { organizationId, merchantCode })
      } catch (base64Error) {
        // Fallback: try to parse as plain JSON
        if (state.includes('{')) {
          const stateData = JSON.parse(state)
          organizationId = stateData.organization_id
          merchantCode = stateData.merchant_code
          console.log('Successfully parsed plain JSON state:', { organizationId, merchantCode })
        } else {
          // Handle simple state format: merchant_M2ZGKSRN_timestamp
          const parts = state.split('_')
          if (parts.length >= 2) {
            merchantCode = parts[1]
            // For now, we'll need to get organization_id from merchant_code
            // This is a fallback for simple state format
            organizationId = undefined
            console.log('Successfully parsed simple state:', { merchantCode })
          } else {
            throw new Error('Invalid state format')
          }
        }
      }
    } catch (stateError) {
      console.error('Failed to parse state parameter:', stateError)
      console.error('State value:', state)
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/oauth-success?error=invalid_state&error_description=Invalid state parameter`)
    }

    try {
      // Get OAuth credentials from merchant code
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data: merchantData, error: merchantDataError } = await supabase
        .from('merchant_codes')
        .select('oauth_client_id, oauth_client_secret_encrypted, encryption_salt, organization_id')
        .eq('merchant_code', merchantCode)
        .eq('is_active', true)
        .single()

      // If organizationId wasn't in state, get it from merchant data
      if (!organizationId && merchantData) {
        organizationId = merchantData.organization_id
      }

      if (merchantDataError || !merchantData) {
        throw new Error('Merchant code not found')
      }

      // For now, use the client secret directly (temporary fix)
      // TODO: Implement proper encryption/decryption
      let clientSecret: string
      
      if (merchantData.oauth_client_secret_encrypted) {
        // Try to decrypt first
        try {
          const encryptionKey = process.env.ENCRYPTION_KEY
          if (encryptionKey) {
            console.log('Attempting to decrypt client secret...')
            clientSecret = decrypt(merchantData.oauth_client_secret_encrypted, encryptionKey, merchantData.encryption_salt)
          } else {
            throw new Error('No encryption key')
          }
        } catch (decryptError) {
          console.log('Decryption failed, using plain text client secret')
          // Fallback: assume it's stored as plain text (for testing)
          clientSecret = merchantData.oauth_client_secret_encrypted
          console.log('Using client secret (first 10 chars):', clientSecret.substring(0, 10) + '...')
          
          // Check if it's a JSON string and extract the actual secret
          if (clientSecret.startsWith('{')) {
            try {
              const parsed = JSON.parse(clientSecret)
              console.log('Parsed JSON:', Object.keys(parsed))
              console.log('Checking GCM fields:', { 
                hasEncrypted: !!parsed.encrypted, 
                hasIv: !!parsed.iv, 
                hasTag: !!parsed.tag,
                ivType: typeof parsed.iv,
                tagType: typeof parsed.tag,
                tagValue: parsed.tag,
                tagLength: parsed.tag ? parsed.tag.length : 'N/A'
              })
              
              if (parsed.encrypted && parsed.iv && parsed.tag && parsed.tag !== 'null' && parsed.tag !== 'undefined' && parsed.tag !== '') {
                console.log('Attempting GCM decryption...')
                // This is GCM encrypted data, try to decrypt it
                try {
                  const encryptionKey = process.env.ENCRYPTION_KEY
                  if (encryptionKey) {
                    const keyBuffer = Buffer.from(encryptionKey, 'hex')
                    const ivBuffer = Buffer.from(parsed.iv, 'hex')
                    const tagBuffer = Buffer.from(parsed.tag, 'hex')
                    const encryptedBuffer = Buffer.from(parsed.encrypted, 'hex')
                    
                    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer)
                    decipher.setAuthTag(tagBuffer)
                    
                    let decrypted = decipher.update(encryptedBuffer)
                    decrypted = Buffer.concat([decrypted, decipher.final()])
                    
                    clientSecret = decrypted.toString('utf8')
                    console.log('Successfully decrypted GCM secret (first 10 chars):', clientSecret.substring(0, 10) + '...')
                  } else {
                    throw new Error('No encryption key for GCM decryption')
                  }
                } catch (gcmError) {
                  console.log('GCM decryption failed:', gcmError instanceof Error ? gcmError.message : 'Unknown error')
                  clientSecret = parsed.encrypted
                }
              } else if (parsed.encrypted && parsed.iv && parsed.tag === '') {
                console.log('Tag is empty, trying CBC decryption with IV...')
                // Try CBC decryption as fallback when tag is empty
                try {
                  const encryptionKey = process.env.ENCRYPTION_KEY
                  if (encryptionKey) {
                    const keyBuffer = Buffer.from(encryptionKey, 'hex')
                    const ivBuffer = Buffer.from(parsed.iv, 'hex')
                    const encryptedBuffer = Buffer.from(parsed.encrypted, 'hex')
                    
                    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer)
                    let decrypted = decipher.update(encryptedBuffer)
                    decrypted = Buffer.concat([decrypted, decipher.final()])
                    
                    clientSecret = decrypted.toString('utf8')
                    console.log('Successfully decrypted CBC secret (first 10 chars):', clientSecret.substring(0, 10) + '...')
                  } else {
                    throw new Error('No encryption key for CBC decryption')
                  }
                } catch (cbcError) {
                  console.log('CBC decryption failed:', cbcError instanceof Error ? cbcError.message : 'Unknown error')
                  clientSecret = parsed.encrypted
                }
              } else if (parsed.encrypted) {
                clientSecret = parsed.encrypted
                console.log('Extracted encrypted secret from JSON (first 10 chars):', clientSecret.substring(0, 10) + '...')
              } else {
                console.log('No encrypted field found in JSON')
              }
            } catch (jsonError) {
              console.log('Not a valid JSON, using as-is')
            }
          }
        }
      } else {
        throw new Error('No client secret found')
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://api.sumup.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: merchantData.oauth_client_id,
          client_secret: clientSecret,
          code: code,
          redirect_uri: `${request.nextUrl.origin}/api/auth/sumup/callback`,
        }).toString(),
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        console.error('Failed to exchange code for tokens:', errorData)
        throw new Error(errorData.error_description || 'Failed to exchange code for tokens')
      }

      const { access_token, refresh_token, expires_in, scope } = await tokenResponse.json()

      console.log('SumUp OAuth Tokens received:', { 
        access_token: access_token ? '***' : null, 
        refresh_token: refresh_token ? '***' : null, 
        expires_in, 
        scope 
      })

      // For now, store tokens as plain text (temporary fix)
      // TODO: Implement proper encryption
      const encryptedAccessToken = { encrypted: access_token, salt: 'temp' }
      const encryptedRefreshToken = { encrypted: refresh_token, salt: 'temp' }

          // Update merchant code with OAuth tokens
          const { error: updateError } = await supabase
            .from('merchant_codes')
            .update({
              oauth_access_token_encrypted: encryptedAccessToken.encrypted,
              oauth_refresh_token_encrypted: encryptedRefreshToken.encrypted,
              oauth_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('merchant_code', merchantCode)
            .eq('organization_id', organizationId)

      if (updateError) {
        console.error('Failed to store OAuth tokens:', updateError)
        throw new Error('Failed to store OAuth tokens')
      }

      console.log('OAuth tokens stored successfully for merchant:', merchantCode)

      // Redirect to a client-side page that can handle the session properly
      // Use a special route that will handle the OAuth success and maintain the session
      const redirectUrl = `${request.nextUrl.origin}/dashboard/oauth-success?merchant_code=${merchantCode}&organization_id=${organizationId}`
      return NextResponse.redirect(redirectUrl)

    } catch (err: any) {
      console.error('SumUp OAuth Callback Error:', err)
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/oauth-success?error=oauth_failed&error_description=${encodeURIComponent(err.message)}`)
    }

  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/oauth-success?error=callback_error&error_description=Internal server error`)
  }
}