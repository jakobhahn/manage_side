import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { email, organizationSlug } = await request.json()

    if (!email || !organizationSlug) {
      return NextResponse.json(
        { error: { message: 'Email and organizationSlug are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find the organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', organizationSlug)
      .single()

    if (orgError || !organization) {
      console.error('Organization not found:', orgError)
      return NextResponse.json(
        { error: { message: 'Organization not found' } },
        { status: 400 }
      )
    }

    // Find the auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers()
    const user = authUser.users.find(u => u.email === email)

    if (authError || !user) {
      console.error('Auth user not found:', authError)
      return NextResponse.json(
        { error: { message: 'Auth user not found' } },
        { status: 400 }
      )
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        auth_id: user.id,
        organization_id: organization.id,
        name: user.user_metadata?.name || 'User',
        email: email,
        role: 'owner',
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json(
        { error: { message: 'Failed to create user profile' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      userId: user.id,
      organizationId: organization.id
    })
  } catch (error) {
    console.error('Create profile error:', error)
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}
