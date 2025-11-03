import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
    const { merchantCodeId, deleteTransactions } = await request.json()

    if (!merchantCodeId) {
      return NextResponse.json(
        { error: { message: 'Merchant code ID is required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key
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

    // Get the merchant code to verify ownership and get merchant_code value
    const { data: merchantCode, error: merchantError } = await supabase
      .from('merchant_codes')
      .select('merchant_code, organization_id, is_active')
      .eq('id', merchantCodeId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (merchantError || !merchantCode) {
      return NextResponse.json(
        { error: { message: 'Merchant code not found or access denied' } },
        { status: 404 }
      )
    }

    // No need to check if already deactivated since we're deleting

    let deletedTransactionsCount = 0

    // If user wants to delete transactions, do it first
    if (deleteTransactions) {
      console.log(`🗑️ Deleting transactions for merchant code: ${merchantCode.merchant_code}`)
      
      // Delete all transactions for this merchant code
      const { error: deleteError, count } = await supabase
        .from('payment_transactions')
        .delete()
        .eq('merchant_code', merchantCode.merchant_code)
        .eq('organization_id', userData.organization_id)

      if (deleteError) {
        console.error('Error deleting transactions:', deleteError)
        return NextResponse.json(
          { error: { message: 'Failed to delete transactions' } },
          { status: 500 }
        )
      }

      deletedTransactionsCount = count || 0
      console.log(`✅ Deleted ${deletedTransactionsCount} transactions`)
    }

    // Delete the merchant code completely
    const { error: deleteError } = await supabase
      .from('merchant_codes')
      .delete()
      .eq('id', merchantCodeId)
      .eq('organization_id', userData.organization_id)

    if (deleteError) {
      console.error('Error deleting merchant code:', deleteError)
      return NextResponse.json(
        { error: { message: 'Failed to delete merchant code' } },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully deleted merchant code: ${merchantCode.merchant_code}`)

    return NextResponse.json({
      success: true,
      message: deleteTransactions 
        ? `Merchant code deleted and ${deletedTransactionsCount} transactions deleted`
        : 'Merchant code deleted successfully',
      deletedTransactions: deleteTransactions ? deletedTransactionsCount : 0
    })

  } catch (error) {
    console.error('Deactivate merchant code error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
