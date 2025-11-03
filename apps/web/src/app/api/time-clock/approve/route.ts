import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: { message: 'Authorization token required' } }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const body = await request.json()
    const { entryId, entryIds } = body

    // Support both single entry and bulk approval
    const idsToApprove = entryIds || (entryId ? [entryId] : [])
    
    if (idsToApprove.length === 0) {
      return NextResponse.json({ error: { message: 'Entry ID(s) required' } }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: { message: 'Invalid token' } }, { status: 401 })
    }

    // Get user data and check permissions
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
    }

    // Only managers and owners can approve
    if (userData.role !== 'manager' && userData.role !== 'owner') {
      return NextResponse.json({ error: { message: 'Insufficient permissions' } }, { status: 403 })
    }

    const approvedAt = new Date().toISOString()
    
    // Update entries (bulk)
    const { data: updatedEntries, error: updateError } = await supabase
      .from('time_clock_entries')
      .update({
        is_approved: true,
        approved_by: userData.id,
        approved_at: approvedAt,
        updated_at: approvedAt
      })
      .in('id', idsToApprove)
      .eq('organization_id', userData.organization_id)
      .select()

    if (updateError) {
      console.error('Failed to approve time clock entries:', updateError)
      return NextResponse.json({ error: { message: 'Failed to approve entries' } }, { status: 500 })
    }

    return NextResponse.json({ 
      entries: updatedEntries || [],
      count: updatedEntries?.length || 0
    })
  } catch (error) {
    console.error('Approve time clock entry error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

