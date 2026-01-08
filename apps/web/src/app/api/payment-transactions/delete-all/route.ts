import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// DELETE /api/payment-transactions/delete-all - Delete all transactions for an organization
export async function DELETE(request: NextRequest) {
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

    // Check if user has permission (only owner or manager can delete transactions)
    if (userData.role !== 'owner' && userData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Delete all transactions for this organization
    const { data: deletedData, error: deleteError, count } = await supabase
      .from('payment_transactions')
      .delete()
      .eq('organization_id', userData.organization_id)
      .select('id')

    if (deleteError) {
      console.error('Error deleting transactions:', deleteError)
      return NextResponse.json(
        { error: { message: `Failed to delete transactions: ${deleteError.message}` } },
        { status: 500 }
      )
    }

    console.log(`✅ Deleted all transactions for organization: ${userData.organization_id}`)

    return NextResponse.json({
      success: true,
      message: `All transactions deleted successfully`,
      deletedCount: deletedData?.length || count || 0
    })
  } catch (error) {
    console.error('Delete all transactions error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}





