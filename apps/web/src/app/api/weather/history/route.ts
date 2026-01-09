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
    const { searchParams } = new URL(request.url)
    
    // Query parameters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const location = searchParams.get('location') // Optional: filter by location
    const limit = parseInt(searchParams.get('limit') || '1000')
    const groupBy = searchParams.get('groupBy') // 'day', 'week', 'month'

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token and get organization
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user's organization
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: { message: 'User profile not found' } },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('weather_history')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('recorded_at', { ascending: false })
      .limit(limit)

    // Apply date filters
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    // Apply location filter (if specified)
    if (location) {
      query = query.ilike('location_address', `%${location}%`)
    }

    const { data: weatherHistory, error: fetchError } = await query

    if (fetchError) {
      console.error('Weather history fetch error:', fetchError)
      return NextResponse.json(
        { error: { message: 'Failed to fetch weather history' } },
        { status: 500 }
      )
    }

    // Group data if requested
    let processedData = weatherHistory || []
    
    if (groupBy && weatherHistory) {
      const grouped = weatherHistory.reduce((acc, record) => {
        let groupKey: string
        const recordDate = new Date(record.recorded_at)
        
        switch (groupBy) {
          case 'day':
            groupKey = record.date
            break
          case 'week':
            const weekStart = new Date(recordDate)
            weekStart.setDate(recordDate.getDate() - recordDate.getDay())
            groupKey = weekStart.toISOString().split('T')[0]
            break
          case 'month':
            groupKey = `${recordDate.getFullYear()}-${(recordDate.getMonth() + 1).toString().padStart(2, '0')}`
            break
          default:
            groupKey = record.date
        }

        if (!acc[groupKey]) {
          acc[groupKey] = {
            period: groupKey,
            location_address: record.location_address,
            latitude: record.latitude,
            longitude: record.longitude,
            data_points: 0,
            avg_temperature: 0,
            min_temperature: Infinity,
            max_temperature: -Infinity,
            total_precipitation: 0,
            avg_humidity: 0,
            avg_wind_speed: 0,
            avg_pressure: 0,
            most_common_weather_code: 0,
            first_recorded: record.recorded_at,
            last_recorded: record.recorded_at
          }
        }

        const group = acc[groupKey]
        group.data_points++
        group.avg_temperature = ((group.avg_temperature * (group.data_points - 1)) + record.temperature) / group.data_points
        group.min_temperature = Math.min(group.min_temperature, record.temperature)
        group.max_temperature = Math.max(group.max_temperature, record.temperature)
        group.total_precipitation += record.precipitation
        group.avg_humidity = ((group.avg_humidity * (group.data_points - 1)) + record.humidity) / group.data_points
        group.avg_wind_speed = ((group.avg_wind_speed * (group.data_points - 1)) + record.wind_speed) / group.data_points
        group.avg_pressure = ((group.avg_pressure * (group.data_points - 1)) + record.pressure) / group.data_points
        
        if (record.recorded_at < group.first_recorded) group.first_recorded = record.recorded_at
        if (record.recorded_at > group.last_recorded) group.last_recorded = record.recorded_at

        return acc
      }, {} as Record<string, any>)

      processedData = Object.values(grouped).map((group: any) => ({
        ...group,
        avg_temperature: Math.round(group.avg_temperature * 10) / 10,
        avg_humidity: Math.round(group.avg_humidity),
        avg_wind_speed: Math.round(group.avg_wind_speed * 10) / 10,
        avg_pressure: Math.round(group.avg_pressure * 10) / 10,
        total_precipitation: Math.round(group.total_precipitation * 10) / 10
      }))
    }

    // Get statistics
    const stats = {
      total_records: weatherHistory?.length || 0,
      date_range: weatherHistory && weatherHistory.length > 0 ? {
        earliest: weatherHistory[weatherHistory.length - 1]?.recorded_at,
        latest: weatherHistory[0]?.recorded_at
      } : null,
      locations: [...new Set(weatherHistory?.map(w => w.location_address) || [])],
      data_sources: [...new Set(weatherHistory?.map(w => w.data_source) || [])]
    }

    console.log(`📊 Retrieved ${weatherHistory?.length || 0} historical weather records for organization ${userProfile.organization_id}`)

    return NextResponse.json({
      success: true,
      data: processedData,
      stats: stats,
      query_params: {
        startDate,
        endDate,
        location,
        limit,
        groupBy
      }
    })

  } catch (error: any) {
    console.error('Weather history API error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch weather history',
      details: error.message 
    }, { status: 500 })
  }
}








