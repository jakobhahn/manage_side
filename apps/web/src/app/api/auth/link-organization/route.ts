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
    const { organizationSlug } = await request.json()

    if (!organizationSlug) {
      return NextResponse.json(
        { error: { message: 'Organization slug is required' } },
        { status: 400 }
      )
    }

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

    // Find the organization by slug
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', organizationSlug)
      .single()

    if (orgError || !organization) {
      return NextResponse.json(
        { error: { message: 'Organization not found' } },
        { status: 404 }
      )
    }

    // Check if user already exists in the organization
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('organization_id', organization.id)
      .single()

    if (existingUser) {
      return NextResponse.json({
        message: 'User already linked to organization',
        organization: organization
      })
    }

    // Create user profile in the organization
    const { error: userProfileError } = await supabase
      .from('users')
      .insert({
        auth_id: user.id,
        organization_id: organization.id,
        name: user.user_metadata?.name || 'Unknown User',
        email: user.email || '',
        role: 'owner' // Default to owner for now
      })

    if (userProfileError) {
      console.error('User profile creation error:', userProfileError)
      return NextResponse.json(
        { error: { message: 'Failed to create user profile: ' + userProfileError.message } },
        { status: 500 }
      )
    }

    // Update the user's organization_id in auth.users metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          organization_id: organization.id,
          role: 'owner'
        }
      }
    )

    if (updateError) {
      console.error('User update error:', updateError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      message: 'User successfully linked to organization',
      organization: organization
    })
  } catch (error) {
    console.error('Link organization error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
