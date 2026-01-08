import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper function to check if user is super_admin
async function isSuperAdmin(token: string): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  
  if (userError || !user) {
    return false
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  return userData?.role === 'super_admin'
}

// GET all organizations (super admin only)
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

    // Check if user is super_admin
    if (!(await isSuperAdmin(token))) {
      return NextResponse.json(
        { error: { message: 'Super admin access required' } },
        { status: 403 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('is_active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('organizations')
      .select(`
        *,
        module_subscriptions (
          id,
          module_name,
          is_active,
          subscribed_at,
          expires_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,billing_email.ilike.%${search}%`)
    }

    if (isActive !== null && isActive !== '') {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: organizations, error, count } = await query

    if (error) {
      console.error('Error fetching organizations:', error)
      return NextResponse.json(
        { error: { message: 'Failed to fetch organizations' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      organizations: organizations || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in GET /api/admin/organizations:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}


