import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' // 64 hex chars = 32 bytes

// Encryption functions
function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: '' // Not used for CBC mode
  }
}

function decrypt(encrypted: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'))
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

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

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user data to check role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found. Please create an organization first by going to /register' } },
        { status: 404 }
      )
    }

    // Get merchant codes for the user's organization
    const { data: merchantCodes, error: fetchError } = await supabase
      .from('merchant_codes')
      .select('id, merchant_code, merchant_name, is_active, sync_status, created_at')
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Merchant codes fetch error:', fetchError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch merchant codes' } },
        { status: 500 }
      )
    }

    return NextResponse.json(merchantCodes || [])
  } catch (error) {
    console.error('Merchant codes fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

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
    const { merchant_code, description, api_key, api_secret } = await request.json()

    if (!merchant_code) {
      return NextResponse.json(
        { error: { message: 'merchant_code is required' } },
        { status: 400 }
      )
    }

    if (!api_key || !api_secret) {
      return NextResponse.json(
        { error: { message: 'api_key and api_secret are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user data to check role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      console.error('User data fetch error:', userDataError)
      return NextResponse.json(
        { error: { message: 'User not found. Please create an organization first by going to /register' } },
        { status: 404 }
      )
    }

    // Check if user has permission (owner or manager)
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions. Only owners and managers can create merchant codes.' } },
        { status: 403 }
      )
    }

    // Check if merchant code already exists
    const { data: existingCode } = await supabase
      .from('merchant_codes')
      .select('id')
      .eq('merchant_code', merchant_code)
      .single()

    if (existingCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code already exists' } },
        { status: 400 }
      )
    }

    // Encrypt API credentials
    const encryptedKey = encrypt(api_key)
    const encryptedSecret = encrypt(api_secret)
    const salt = crypto.randomBytes(32).toString('hex')

    // Insert new merchant code with encrypted credentials
    const { data: newMerchantCode, error: insertError } = await supabase
      .from('merchant_codes')
      .insert({
        organization_id: userData.organization_id,
        merchant_code,
        merchant_name: description || merchant_code,
        api_key_encrypted: JSON.stringify(encryptedKey),
        api_secret_encrypted: JSON.stringify(encryptedSecret),
        encryption_salt: salt,
        is_active: true,
        sync_status: 'inactive'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Merchant code creation error:', insertError)
      return NextResponse.json(
        { error: { message: 'Failed to create merchant code: ' + insertError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json(newMerchantCode)
  } catch (error) {
    console.error('Merchant code creation error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}