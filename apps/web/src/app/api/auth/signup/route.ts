import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, organizationName, organizationSlug } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: { message: 'Email, password, and name are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: { message: authError.message || 'Authentication failed' } },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: { message: 'Failed to create user' } },
        { status: 500 }
      )
    }

    // If organization info is provided, create user profile and link to organization
    if (organizationName && organizationSlug) {
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

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          organization_id: organization.id,
          name,
          email,
          role: 'owner',
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return NextResponse.json(
          { error: { message: 'Failed to create user profile' } },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      user: authData.user,
      session: authData.session,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}