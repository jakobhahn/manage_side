import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: { message: 'Email and password are required' } },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 401 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: { message: 'Login failed' } },
        { status: 401 }
      )
    }

    // Check if user has an organization
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('organization_id, role, name')
      .eq('auth_id', data.user.id)
      .single()

    if (profileError || !userProfile?.organization_id) {
      return NextResponse.json(
        { error: { message: 'User profile not found. Please contact support.' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      profile: userProfile
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
