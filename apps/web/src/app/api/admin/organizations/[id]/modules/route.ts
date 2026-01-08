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

// GET all modules for an organization
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

    const { data: modules, error } = await supabase
      .from('module_subscriptions')
      .select('*')
      .eq('organization_id', id)
      .order('module_name', { ascending: true })

    if (error) {
      console.error('Error fetching modules:', error)
      return NextResponse.json(
        { error: { message: 'Failed to fetch modules' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ modules: modules || [] })
  } catch (error) {
    console.error('Error in GET /api/admin/organizations/[id]/modules:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST/PATCH toggle module for an organization
export async function POST(
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
    const { id: organizationId } = await params
    const { module_name, is_active, expires_at } = await request.json()

    if (!module_name) {
      return NextResponse.json(
        { error: { message: 'module_name is required' } },
        { status: 400 }
      )
    }

    // Check if user is super_admin
    if (!(await isSuperAdmin(token))) {
      return NextResponse.json(
        { error: { message: 'Super admin access required' } },
        { status: 403 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if module subscription exists
    const { data: existing } = await supabase
      .from('module_subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('module_name', module_name)
      .single()

    let moduleSubscription

    if (existing) {
      // Update existing subscription
      const { data, error } = await supabase
        .from('module_subscriptions')
        .update({
          is_active: is_active !== undefined ? is_active : true,
          expires_at: expires_at || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating module subscription:', error)
        return NextResponse.json(
          { error: { message: 'Failed to update module subscription' } },
          { status: 500 }
        )
      }

      moduleSubscription = data
    } else {
      // Create new subscription
      const { data, error } = await supabase
        .from('module_subscriptions')
        .insert({
          organization_id: organizationId,
          module_name,
          is_active: is_active !== undefined ? is_active : true,
          expires_at: expires_at || null
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating module subscription:', error)
        return NextResponse.json(
          { error: { message: 'Failed to create module subscription' } },
          { status: 500 }
        )
      }

      moduleSubscription = data
    }

    return NextResponse.json({ module: moduleSubscription })
  } catch (error) {
    console.error('Error in POST /api/admin/organizations/[id]/modules:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}


