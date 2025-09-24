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

    // Get user's organization_id from the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission to view users (owner or manager)
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Fetch all users in the organization
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })

    if (usersError) {
      return NextResponse.json(
        { error: { message: 'Failed to fetch users' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: users || [] })
  } catch (error) {
    console.error('Users fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, role, password } = await request.json()
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

    // Get user's organization_id and role
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission to create users (owner or manager)
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Create the new user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name,
        organization_id: userData.organization_id,
        role
      },
      email_confirm: true
    })

    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message } },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: { message: 'Failed to create user' } },
        { status: 500 }
      )
    }

    // Create the user record in our users table
    const { data: newUser, error: userCreateError } = await supabase
      .from('users')
      .insert({
        auth_id: authData.user.id,
        organization_id: userData.organization_id,
        email,
        name,
        role,
        is_active: true
      })
      .select()
      .single()

    if (userCreateError) {
      // If user creation in our table fails, clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      console.error('User creation error:', userCreateError)
      return NextResponse.json(
        { error: { message: 'Failed to create user record: ' + userCreateError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: newUser,
      message: 'User created successfully'
    })
  } catch (error) {
    console.error('User creation error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: { message: 'User ID is required' } },
        { status: 400 }
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

    // Get user's organization_id and role
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission to delete users (owner or manager)
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Get the user to be deleted
    const { data: userToDelete, error: fetchError } = await supabase
      .from('users')
      .select('auth_id, organization_id')
      .eq('id', userId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (fetchError || !userToDelete) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Delete the user from our users table
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      return NextResponse.json(
        { error: { message: 'Failed to delete user' } },
        { status: 500 }
      )
    }

    // Delete the user from Supabase Auth
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userToDelete.auth_id)

    if (authDeleteError) {
      console.error('Auth user deletion error:', authDeleteError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('User deletion error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
