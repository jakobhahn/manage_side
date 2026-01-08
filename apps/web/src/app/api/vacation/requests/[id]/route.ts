import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// PUT /api/vacation/requests/[id] - Update vacation request (approve/reject/cancel)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, review_notes } = body

    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization_id and role
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role, id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Get the vacation request
    const { data: vacationRequest, error: requestError } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (requestError || !vacationRequest) {
      return NextResponse.json(
        { error: { message: 'Vacation request not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission
    if (vacationRequest.user_id === userData.id) {
      // User can only cancel their own pending requests
      if (status === 'cancelled' && vacationRequest.status === 'pending') {
        const { data: updatedRequest, error: updateError } = await supabase
          .from('vacation_requests')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select(`
            *,
            user:users!vacation_requests_user_id_fkey(
              id,
              name,
              email
            ),
            reviewed_by_user:users!vacation_requests_reviewed_by_fkey(
              id,
              name
            )
          `)
          .single()

        if (updateError) {
          console.error('Failed to cancel vacation request:', updateError)
          return NextResponse.json(
            { error: { message: 'Failed to cancel vacation request' } },
            { status: 500 }
          )
        }

        return NextResponse.json({ request: updatedRequest })
      } else {
        return NextResponse.json(
          { error: { message: 'You can only cancel your own pending requests' } },
          { status: 403 }
        )
      }
    } else if (['owner', 'manager'].includes(userData.role)) {
      // Managers/owners can approve/reject
      if (!['approved', 'rejected'].includes(status)) {
        return NextResponse.json(
          { error: { message: 'Invalid status. Only approved or rejected are allowed for managers.' } },
          { status: 400 }
        )
      }

      if (vacationRequest.status !== 'pending') {
        return NextResponse.json(
          { error: { message: 'Only pending requests can be approved or rejected' } },
          { status: 400 }
        )
      }

      // Update the request
      const updateData: any = {
        status: status,
        reviewed_by: userData.id,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes || null,
        updated_at: new Date().toISOString()
      }

      const { data: updatedRequest, error: updateError } = await supabase
        .from('vacation_requests')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          user:users!vacation_requests_user_id_fkey(
            id,
            name,
            email
          ),
          reviewed_by_user:users!vacation_requests_reviewed_by_fkey(
            id,
            name
          )
        `)
        .single()

      if (updateError) {
        console.error('Failed to update vacation request:', updateError)
        return NextResponse.json(
          { error: { message: 'Failed to update vacation request' } },
          { status: 500 }
        )
      }

      // If approved, update the vacation balance
      if (status === 'approved') {
        const currentYear = new Date(vacationRequest.start_date).getFullYear()
        
        // Get or create balance for the year
        const { data: balance } = await supabase
          .from('vacation_balances')
          .select('*')
          .eq('organization_id', vacationRequest.organization_id)
          .eq('user_id', vacationRequest.user_id)
          .eq('year', currentYear)
          .single()

        if (balance) {
          // Update existing balance
          await supabase
            .from('vacation_balances')
            .update({
              used_days: balance.used_days + vacationRequest.days,
              updated_at: new Date().toISOString()
            })
            .eq('id', balance.id)
        } else {
          // Create new balance (assuming total_days needs to be set by manager)
          // For now, we'll just track used_days
          await supabase
            .from('vacation_balances')
            .insert({
              organization_id: vacationRequest.organization_id,
              user_id: vacationRequest.user_id,
              year: currentYear,
              total_days: 0, // Manager needs to set this
              used_days: vacationRequest.days
            })
        }
      }

      return NextResponse.json({ request: updatedRequest })
    } else {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }
  } catch (error) {
    console.error('Vacation request update error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}


