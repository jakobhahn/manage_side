import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST - Reset user password
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
    const { id: userId } = await params
    const { newPassword } = await request.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: { message: 'Password must be at least 6 characters long' } },
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

    // Check if target user exists and belongs to the same organization
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id, auth_id, email, name')
      .eq('id', userId)
      .eq('organization_id', currentUserData.organization_id)
      .single()

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Update password in auth.users
    const { error: passwordUpdateError } = await supabase.auth.admin.updateUserById(
      targetUser.auth_id,
      { password: newPassword }
    )

    if (passwordUpdateError) {
      console.error('Password update error:', passwordUpdateError)
      return NextResponse.json(
        { error: { message: 'Failed to update password: ' + passwordUpdateError.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Password updated successfully',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name
      }
    })
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
