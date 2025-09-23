import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Encryption configuration (must match the one in merchant-codes/route.ts)
const ENCRYPTION_ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' // 64 hex chars = 32 bytes

// Decryption function
function decrypt(encrypted: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'))
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint is for n8n to fetch credentials
    // It should be protected by a shared secret or API key
    const authHeader = request.headers.get('authorization')
    const n8nSecret = process.env.N8N_SHARED_SECRET
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== n8nSecret) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    const merchantCode = searchParams.get('merchant_code')

    if (!organizationId || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'organization_id and merchant_code are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch merchant code with encrypted credentials
    const { data: merchantCodeData, error: fetchError } = await supabase
      .from('merchant_codes')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('merchant_code', merchantCode)
      .eq('is_active', true)
      .single()

    if (fetchError || !merchantCodeData) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

    // Decrypt API credentials
    const keyData = JSON.parse(merchantCodeData.api_key_encrypted)
    const secretData = JSON.parse(merchantCodeData.api_secret_encrypted)
    
    const decryptedApiKey = decrypt(keyData.encrypted, keyData.iv, keyData.tag)
    const decryptedApiSecret = decrypt(secretData.encrypted, secretData.iv, secretData.tag)

    // Return decrypted credentials for n8n
    return NextResponse.json({
      merchant_code: merchantCodeData.merchant_code,
      api_key: decryptedApiKey,
      api_secret: decryptedApiSecret,
      organization_id: merchantCodeData.organization_id,
      webhook_url: merchantCodeData.webhook_url,
      last_sync_at: merchantCodeData.last_sync_at,
      sync_status: merchantCodeData.sync_status
    })
  } catch (error) {
    console.error('Credentials fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
