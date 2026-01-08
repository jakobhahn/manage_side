import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// SumUp webhook signature verification
function verifySumUpSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  // Ensure both signatures have the same length
  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }
  
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('x-sumup-signature')
    const webhookSecret = process.env.SUMUP_WEBHOOK_SECRET

    console.log('Webhook received:', { 
      hasSignature: !!signature, 
      hasSecret: !!webhookSecret,
      payloadLength: payload.length 
    })

    if (!signature || !webhookSecret) {
      console.error('Missing SumUp webhook signature or secret')
      return NextResponse.json(
        { error: { message: 'Missing authentication' } },
        { status: 401 }
      )
    }

    // Verify webhook signature
    if (!verifySumUpSignature(payload, signature, webhookSecret)) {
      console.error('Invalid SumUp webhook signature')
      return NextResponse.json(
        { error: { message: 'Invalid signature' } },
        { status: 401 }
      )
    }

    const transaction = JSON.parse(payload)
    
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find organization by merchant code
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('organization_id')
      .eq('merchant_code', transaction.merchant_code)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchantCode) {
      console.error('Merchant code not found:', transaction.merchant_code)
      return NextResponse.json(
        { error: { message: 'Merchant code not found' } },
        { status: 404 }
      )
    }

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

    // Insert transaction into database
    const { error: insertError } = await supabase
      .from('payment_transactions')
      .insert({
        organization_id: merchantCode.organization_id,
        transaction_id: transaction.id,
        amount: parseFloat(transaction.amount),
        currency: transaction.currency,
        status: 'completed', // Set default status
        merchant_code: transaction.merchant_code, // Add merchant code
        transaction_date: new Date(transaction.timestamp),
        tip_amount: extractTip(transaction),
        vat_amount: extractVat(transaction),
        raw_data: transaction
      })

    if (insertError) {
      console.error('Failed to insert transaction:', insertError)
      return NextResponse.json(
        { error: { message: 'Failed to process transaction' } },
        { status: 500 }
      )
    }

    console.log('Transaction processed successfully:', transaction.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('SumUp webhook error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
