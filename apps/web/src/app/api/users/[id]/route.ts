import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET - Get single user
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
    const { id: userId } = await params

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

    // Get current user data to check permissions
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (currentUserError || !currentUserData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission (owner or manager)
    if (currentUserData.role !== 'owner' && currentUserData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Get the requested user
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, last_login, hourly_rate, position_id, employment_type, created_at, updated_at')
      .eq('id', userId)
      .eq('organization_id', currentUserData.organization_id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json(userData)
  } catch (error) {
    console.error('User fetch error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// PATCH - Update user
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
    const { id: userId } = await params
    const { name, email, role, is_active, hourly_rate, position_id, employment_type } = await request.json()

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

    // Get current user data to check permissions
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (currentUserError || !currentUserData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission (owner or manager)
    if (currentUserData.role !== 'owner' && currentUserData.role !== 'manager') {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Check if user exists and belongs to the same organization
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, auth_id, email')
      .eq('id', userId)
      .eq('organization_id', currentUserData.organization_id)
      .single()

    if (existingUserError || !existingUser) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (is_active !== undefined) updateData.is_active = is_active
    if (hourly_rate !== undefined) {
      updateData.hourly_rate = hourly_rate === '' || hourly_rate === null ? null : parseFloat(hourly_rate.toString())
    }
    if (employment_type !== undefined) {
      // Validate employment_type
      if (employment_type && !['mini', 'teilzeit', 'vollzeit', 'werkstudent'].includes(employment_type)) {
        return NextResponse.json(
          { error: { message: 'Invalid employment_type. Must be one of: mini, teilzeit, vollzeit, werkstudent' } },
          { status: 400 }
        )
      }
      updateData.employment_type = employment_type === '' ? null : employment_type
    }
    if (position_id !== undefined) {
      // Validate position_id if provided (must belong to same organization)
      if (position_id && position_id !== null) {
        const { data: positionData, error: positionError } = await supabase
          .from('positions')
          .select('id, organization_id')
          .eq('id', position_id)
          .single()
        
        if (positionError || !positionData) {
          return NextResponse.json(
            { error: { message: 'Position not found' } },
            { status: 404 }
          )
        }
        
        if (positionData.organization_id !== currentUserData.organization_id) {
          return NextResponse.json(
            { error: { message: 'Cannot use position from different organization' } },
            { status: 403 }
          )
        }
      }
      updateData.position_id = position_id === '' ? null : position_id
    }
    updateData.updated_at = new Date().toISOString()

    // Update user in public.users table
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, name, email, role, is_active, last_login, hourly_rate, position_id, employment_type, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('User update error:', updateError)
      return NextResponse.json(
        { error: { message: 'Failed to update user: ' + updateError.message } },
        { status: 500 }
      )
    }

    // If email is being updated, also update in auth.users
    if (email && email !== existingUser.email) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        existingUser.auth_id,
        { email }
      )

      if (authUpdateError) {
        console.error('Auth email update error:', authUpdateError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('User update error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// DELETE - Delete user
export async function DELETE(
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
    const { id: userId } = await params

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

    // Get current user data to check permissions
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('auth_id', user.id)
      .single()

    if (currentUserError || !currentUserData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Check if user has permission (only owner can delete users)
    if (currentUserData.role !== 'owner') {
      return NextResponse.json(
        { error: { message: 'Only owners can delete users' } },
        { status: 403 }
      )
    }

    // Check if user exists and belongs to the same organization
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, auth_id, role')
      .eq('id', userId)
      .eq('organization_id', currentUserData.organization_id)
      .single()

    if (existingUserError || !existingUser) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Prevent deleting the last owner
    if (existingUser.role === 'owner') {
      const { data: ownerCount } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentUserData.organization_id)
        .eq('role', 'owner')
        .eq('is_active', true)

      if (ownerCount && ownerCount.length <= 1) {
        return NextResponse.json(
          { error: { message: 'Cannot delete the last owner' } },
          { status: 400 }
        )
      }
    }

    // Delete user from auth.users (this will cascade to public.users due to foreign key)
    if (existingUser.auth_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
        existingUser.auth_id
      )

      if (authDeleteError) {
        console.error('Auth user delete error:', authDeleteError)
        // If auth user doesn't exist, just delete from public.users
        if (authDeleteError.message.includes('User not found')) {
          const { error: publicDeleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)

          if (publicDeleteError) {
            return NextResponse.json(
              { error: { message: 'Failed to delete user from database' } },
              { status: 500 }
            )
          }
        } else {
          return NextResponse.json(
            { error: { message: 'Failed to delete user: ' + authDeleteError.message } },
            { status: 500 }
          )
        }
      }
    } else {
      // If no auth_id, just delete from public.users
      const { error: publicDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (publicDeleteError) {
        return NextResponse.json(
          { error: { message: 'Failed to delete user from database' } },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('User delete error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
