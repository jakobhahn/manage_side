import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// DELETE /api/shift-templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Only managers and owners can delete templates
    if (userData.role !== 'manager' && userData.role !== 'owner') {
      return NextResponse.json(
        { error: { message: 'Permission denied' } },
        { status: 403 }
      )
    }

    // Verify template belongs to user's organization
    const { data: template, error: templateError } = await supabase
      .from('shift_templates')
      .select('id, organization_id')
      .eq('id', params.id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: { message: 'Template not found' } },
        { status: 404 }
      )
    }

    if (template.organization_id !== userData.organization_id) {
      return NextResponse.json(
        { error: { message: 'Permission denied' } },
        { status: 403 }
      )
    }

    // Delete template (items will be deleted via CASCADE)
    const { error: deleteError } = await supabase
      .from('shift_templates')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting template:', deleteError)
      return NextResponse.json(
        { error: { message: 'Failed to delete template' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete template API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

