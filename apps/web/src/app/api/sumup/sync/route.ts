import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// SumUp API configuration
const SUMUP_API_URL = 'https://api.sumup.com/v0.1'
const SUMUP_CLIENT_ID = process.env.SUMUP_CLIENT_ID
const SUMUP_CLIENT_SECRET = process.env.SUMUP_CLIENT_SECRET

interface SumUpTransaction {
  id: string
  amount: string
  currency: string
  timestamp: string
  merchant_code: string
  status: string
  payment_type: string
  product_summary: string
}

async function getSumUpAccessToken(): Promise<string> {
  const response = await fetch('https://api.sumup.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SUMUP_CLIENT_ID!,
      client_secret: SUMUP_CLIENT_SECRET!,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to get SumUp access token')
  }

  const data = await response.json()
  return data.access_token
}

async function fetchSumUpTransactions(
  accessToken: string,
  merchantCode: string,
  fromDate: string,
  toDate: string
): Promise<SumUpTransaction[]> {
  const response = await fetch(
    `${SUMUP_API_URL}/me/transactions?merchant_code=${merchantCode}&from=${fromDate}&to=${toDate}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch SumUp transactions')
  }

  const data = await response.json()
  return data.transactions || []
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
    const { organizationId, fromDate, toDate } = await request.json()

    if (!organizationId || !fromDate || !toDate) {
      return NextResponse.json(
        { error: { message: 'organizationId, fromDate, and toDate are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token and get user data
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user data to check permissions
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

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

    // Get merchant codes for this organization
    const { data: merchantCodes, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('merchant_code')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (merchantError || !merchantCodes || merchantCodes.length === 0) {
      return NextResponse.json(
        { error: { message: 'No active merchant codes found for this organization' } },
        { status: 404 }
      )
    }

    // Get SumUp access token
    const accessToken = await getSumUpAccessToken()

    // Fetch transactions for each merchant code
    const allTransactions: SumUpTransaction[] = []
    for (const merchantCode of merchantCodes) {
      try {
        const transactions = await fetchSumUpTransactions(
          accessToken,
          merchantCode.merchant_code,
          fromDate,
          toDate
        )
        allTransactions.push(...transactions)
      } catch (error) {
        console.error(`Failed to fetch transactions for merchant ${merchantCode.merchant_code}:`, error)
        // Continue with other merchant codes
      }
    }

    // Insert transactions into database
    const transactionsToInsert = allTransactions.map(transaction => ({
      organization_id: organizationId,
      transaction_id: transaction.id,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      transaction_date: new Date(transaction.timestamp),
      raw_data: transaction
    }))

    if (transactionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('payment_transactions')
        .upsert(transactionsToInsert, {
          onConflict: 'transaction_id,organization_id'
        })

      if (insertError) {
        console.error('Failed to insert transactions:', insertError)
        return NextResponse.json(
          { error: { message: 'Failed to save transactions' } },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      transactionsProcessed: transactionsToInsert.length,
      message: `Successfully synced ${transactionsToInsert.length} transactions`
    })
  } catch (error) {
    console.error('SumUp sync error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
