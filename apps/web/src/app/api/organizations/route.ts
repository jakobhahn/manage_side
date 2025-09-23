import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { name, slug, ownerName, ownerEmail } = await request.json()
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

    // Check if organization slug already exists
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingOrg) {
      return NextResponse.json(
        { error: { message: 'Organization slug already exists' } },
        { status: 400 }
      )
    }

    // Create organization with owner using the database function
    const { data: orgId, error: orgError } = await supabase
      .rpc('create_organization_with_owner', {
        org_name: name,
        org_slug: slug,
        owner_email: ownerEmail,
        owner_name: ownerName
      })

    if (orgError) {
      console.error('Organization creation error:', orgError)
      return NextResponse.json(
        { error: { message: 'Failed to create organization: ' + orgError.message } },
        { status: 500 }
      )
    }

    if (!orgId) {
      console.error('Organization creation returned no ID')
      return NextResponse.json(
        { error: { message: 'Organization creation returned no ID' } },
        { status: 500 }
      )
    }

    console.log('Organization created successfully with ID:', orgId)

    // Update the user's organization_id in auth.users metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          organization_id: orgId,
          role: 'owner'
        }
      }
    )

    if (updateError) {
      console.error('User update error:', updateError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      organizationId: orgId,
      message: 'Organization created successfully'
    })
  } catch (error) {
    console.error('Organization creation error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
