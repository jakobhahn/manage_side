import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/vacation/balances - Get vacation balances
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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    // Build query
    let query = supabase
      .from('vacation_balances')
      .select(`
        *,
        user:users!vacation_balances_user_id_fkey(
          id,
          name,
          email
        )
      `)
      .eq('organization_id', userData.organization_id)
      .eq('year', parseInt(year))
      .order('year', { ascending: false })

    // Staff can only see their own balance
    if (userData.role === 'staff') {
      query = query.eq('user_id', userData.id)
    } else if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: balances, error: balancesError } = await query

    if (balancesError) {
      console.error('Vacation balances fetch error:', balancesError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch vacation balances' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ balances: balances || [] })
  } catch (error) {
    console.error('Vacation balances API error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/vacation/balances - Create or update vacation balance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, year, total_days } = body

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

    // Only managers/owners can create/update balances
    if (!['owner', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: { message: 'Insufficient permissions. Only managers and owners can manage vacation balances.' } },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!user_id || !year || total_days === undefined) {
      return NextResponse.json(
        { error: { message: 'user_id, year, and total_days are required' } },
        { status: 400 }
      )
    }

    // Verify target user belongs to same organization
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('id', user_id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (!targetUser) {
      return NextResponse.json(
        { error: { message: 'Target user not found or does not belong to your organization' } },
        { status: 404 }
      )
    }

    // Check if balance already exists
    const { data: existingBalance } = await supabase
      .from('vacation_balances')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .eq('user_id', user_id)
      .eq('year', year)
      .single()

    if (existingBalance) {
      // Update existing balance
      const { data: updatedBalance, error: updateError } = await supabase
        .from('vacation_balances')
        .update({
          total_days: total_days,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBalance.id)
        .select(`
          *,
          user:users!vacation_balances_user_id_fkey(
            id,
            name,
            email
          )
        `)
        .single()

      if (updateError) {
        console.error('Failed to update vacation balance:', updateError)
        return NextResponse.json(
          { error: { message: 'Failed to update vacation balance' } },
          { status: 500 }
        )
      }

      return NextResponse.json({ balance: updatedBalance })
    } else {
      // Create new balance
      const { data: newBalance, error: createError } = await supabase
        .from('vacation_balances')
        .insert({
          organization_id: userData.organization_id,
          user_id: user_id,
          year: year,
          total_days: total_days,
          used_days: 0
        })
        .select(`
          *,
          user:users!vacation_balances_user_id_fkey(
            id,
            name,
            email
          )
        `)
        .single()

      if (createError) {
        console.error('Failed to create vacation balance:', createError)
        return NextResponse.json(
          { error: { message: 'Failed to create vacation balance' } },
          { status: 500 }
        )
      }

      return NextResponse.json({ balance: newBalance }, { status: 201 })
    }
  } catch (error) {
    console.error('Vacation balance creation error:', error)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}


