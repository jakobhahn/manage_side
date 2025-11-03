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
    const { entryId, reason } = body

    if (!entryId) {
      return NextResponse.json({ error: { message: 'Entry ID required' } }, { status: 400 })
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

    // Only managers and owners can reject
    if (userData.role !== 'manager' && userData.role !== 'owner') {
      return NextResponse.json({ error: { message: 'Insufficient permissions' } }, { status: 403 })
    }

    // For now, we'll just delete the entry when rejected
    // In a production system, you might want to mark it as rejected instead of deleting
    const { data: deletedEntry, error: deleteError } = await supabase
      .from('time_clock_entries')
      .delete()
      .eq('id', entryId)
      .eq('organization_id', userData.organization_id)
      .select()
      .single()

    if (deleteError) {
      console.error('Failed to reject time clock entry:', deleteError)
      return NextResponse.json({ error: { message: 'Failed to reject entry' } }, { status: 500 })
    }

    return NextResponse.json({ entry: deletedEntry })
  } catch (error) {
    console.error('Reject time clock entry error:', error)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}


