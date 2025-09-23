import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'daily'

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

    // Fetch revenue analytics data
    const { data: revenueData, error: revenueError } = await supabase
      .from('revenue_analytics')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .eq('period_type', period)
      .order('period_start', { ascending: false })
      .limit(30) // Limit to last 30 periods

    if (revenueError) {
      console.error('Revenue fetch error:', revenueError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch revenue data' } },
        { status: 500 }
      )
    }

    return NextResponse.json(revenueData || [])
  } catch (error) {
    console.error('Revenue fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
