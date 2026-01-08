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

// GET single organization (super admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { id } = await params

    // Check if user is super_admin
    if (!(await isSuperAdmin(token))) {
      return NextResponse.json(
        { error: { message: 'Super admin access required' } },
        { status: 403 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: organization, error } = await supabase
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
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching organization:', error)
      return NextResponse.json(
        { error: { message: 'Organization not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Error in GET /api/admin/organizations/[id]:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// PATCH update organization (super admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { id } = await params
    const updateData = await request.json()

    // Check if user is super_admin
    if (!(await isSuperAdmin(token))) {
      return NextResponse.json(
        { error: { message: 'Super admin access required' } },
        { status: 403 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update organization
    const { data: organization, error } = await supabase
      .from('organizations')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating organization:', error)
      return NextResponse.json(
        { error: { message: 'Failed to update organization' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Error in PATCH /api/admin/organizations/[id]:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}


