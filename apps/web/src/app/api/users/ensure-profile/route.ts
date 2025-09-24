import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]

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

    // Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (existingProfile) {
      return NextResponse.json({
        message: 'User profile already exists',
        user: existingProfile
      })
    }

    // Get organization_id from user metadata
    const organizationId = user.user_metadata?.organization_id

    if (!organizationId) {
      return NextResponse.json(
        { error: { message: 'User is not linked to an organization' } },
        { status: 400 }
      )
    }

    // Create user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .insert({
        auth_id: user.id,
        organization_id: organizationId,
        name: user.user_metadata?.name || user.email || 'Unknown User',
        email: user.email || '',
        role: user.user_metadata?.role || 'staff'
      })
      .select()
      .single()

    if (profileError) {
      console.error('User profile creation error:', profileError)
      return NextResponse.json(
        { error: { message: 'Failed to create user profile: ' + profileError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'User profile created successfully',
      user: userProfile
    })
  } catch (error) {
    console.error('Ensure profile error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
