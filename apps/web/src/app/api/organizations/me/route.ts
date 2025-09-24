import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function fetchUserOrganization(supabase: any, supabaseAdmin: any, user: any) {
  try {
    // Get the user's profile - try by auth_id first, then by email
    let { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, name, email, role, organization_id')
      .eq('auth_id', user.id)
      .single()

    // If not found by auth_id, try by email
    if (profileError && user.email) {
      console.log('User not found by auth_id, trying by email:', user.email)
      const { data: userByEmail, error: emailError } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role, organization_id')
        .eq('email', user.email)
        .single()
      
      if (!emailError && userByEmail) {
        userProfile = userByEmail
        profileError = null
        
        // Update the auth_id to match
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ auth_id: user.id })
          .eq('id', userProfile.id)
        
        if (updateError) {
          console.error('Failed to update auth_id:', updateError)
        } else {
          console.log('Updated auth_id for user:', userProfile.id)
        }
      }
    }

    if (profileError || !userProfile) {
      console.error('Profile error:', profileError)
      console.error('Looking for auth_id:', user.id)
      
      // Try to create user profile if it doesn't exist
      const organizationId = user.user_metadata?.organization_id
      
      if (organizationId) {
        console.log('Creating missing user profile for auth_id:', user.id)
        
        const { data: newProfile, error: createError } = await supabaseAdmin
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

        if (createError) {
          console.error('Failed to create user profile:', createError)
          return NextResponse.json({ error: 'User profile not found and could not be created' }, { status: 404 })
        }

        // Use the newly created profile
        const { data: organization, error: orgError } = await supabaseAdmin
          .from('organizations')
          .select('id, name, slug, created_at')
          .eq('id', organizationId)
          .single()

        if (orgError) {
          console.error('Organization error:', orgError)
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
        }

        return NextResponse.json({
          user: {
            id: newProfile.id,
            name: newProfile.name,
            email: newProfile.email,
            role: newProfile.role,
            organization_id: newProfile.organization_id
          },
          organization: organization
        }, { status: 200 })
      }
      
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get the organization details separately
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, created_at')
      .eq('id', userProfile.organization_id)
      .single()

    if (orgError) {
      console.error('Organization error:', orgError)
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        organization_id: userProfile.organization_id
      },
      organization: organization
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching user organization:', error)
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  // If Authorization header is provided, use it directly
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    
    // Create a simple Supabase client for token validation
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Create a service role client for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return await fetchUserOrganization(supabase, supabaseAdmin, user)
  }
  
  // Fallback to cookie-based auth
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return await cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create admin client for fallback
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  return await fetchUserOrganization(supabase, supabaseAdmin, user)
}

export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { name, slug } = await request.json()

    if (!name || !slug) {
      return NextResponse.json(
        { error: { message: 'Organization name and slug are required' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key for admin operations
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, name, email, role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: { message: 'User profile not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission (owner or manager)
    if (userProfile.role !== 'owner' && userProfile.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Check if organization slug already exists (excluding current organization)
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .neq('id', userProfile.organization_id)
      .single()

    if (existingOrg) {
      return NextResponse.json(
        { error: { message: 'Organization slug already exists' } },
        { status: 400 }
      )
    }

    // Update organization
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update({
        name,
        slug
      })
      .eq('id', userProfile.organization_id)
      .select()
      .single()

    if (updateError) {
      console.error('Organization update error:', updateError)
      return NextResponse.json(
        { error: { message: 'Failed to update organization: ' + updateError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      organization: updatedOrg,
      message: 'Organization updated successfully'
    })
  } catch (error) {
    console.error('Organization update error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
