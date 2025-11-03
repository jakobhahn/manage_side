import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/shift-templates - Get all templates for the organization
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization_id
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

    // Get all templates for the organization with items
    const { data: templates, error: templatesError } = await supabase
      .from('shift_templates')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        created_by,
        shift_template_items (
          id,
          day_of_week,
          start_time,
          end_time,
          user_id,
          position_id,
          notes,
          status,
          sort_order
        )
      `)
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })

    if (templatesError) {
      console.error('Error fetching templates:', templatesError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch templates' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates: templates || [] })
  } catch (error: any) {
    console.error('Shift templates API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/shift-templates - Create a new template
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
      .select('organization_id, role, id')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Only managers and owners can create templates
    if (userData.role !== 'manager' && userData.role !== 'owner') {
      return NextResponse.json(
        { error: { message: 'Permission denied' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, items } = body

    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: { message: 'Name and items are required' } },
        { status: 400 }
      )
    }

    // Check if template name already exists for this organization
    const { data: existingTemplate } = await supabase
      .from('shift_templates')
      .select('id')
      .eq('organization_id', userData.organization_id)
      .eq('name', name)
      .single()

    if (existingTemplate) {
      return NextResponse.json(
        { error: { message: 'Template with this name already exists' } },
        { status: 409 }
      )
    }

    // Create template
    const { data: template, error: templateError } = await supabase
      .from('shift_templates')
      .insert({
        organization_id: userData.organization_id,
        name,
        description: description || null,
        created_by: userData.id
      })
      .select()
      .single()

    if (templateError || !template) {
      console.error('Error creating template:', templateError)
      return NextResponse.json(
        { error: { message: `Failed to create template: ${templateError?.message || 'Unknown error'}` } },
        { status: 500 }
      )
    }

    // Create template items
    const templateItems = items.map((item: any, index: number) => ({
      template_id: template.id,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      end_time: item.end_time,
      user_id: item.user_id || null,
      position_id: item.position_id || null,
      notes: item.notes || null,
      status: item.status || 'scheduled',
      sort_order: index
    }))

    const { error: itemsError } = await supabase
      .from('shift_template_items')
      .insert(templateItems)

    if (itemsError) {
      // Rollback: delete the template if items insertion fails
      await supabase.from('shift_templates').delete().eq('id', template.id)
      console.error('Error creating template items:', itemsError)
      return NextResponse.json(
        { error: { message: `Failed to create template items: ${itemsError.message || 'Unknown error'}` } },
        { status: 500 }
      )
    }

    // Fetch the complete template with items
    const { data: completeTemplate, error: fetchError } = await supabase
      .from('shift_templates')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        created_by,
        shift_template_items (
          id,
          day_of_week,
          start_time,
          end_time,
          user_id,
          position_id,
          notes,
          status,
          sort_order
        )
      `)
      .eq('id', template.id)
      .single()

    if (fetchError) {
      console.error('Error fetching created template:', fetchError)
    }

    return NextResponse.json({ template: completeTemplate || template })
  } catch (error: any) {
    console.error('Shift templates API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

