import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WeatherData {
  date: string
  hour: number
  temperature: number
  precipitation: number
  weatherCode: number
  windSpeed: number
  humidity: number
  pressure: number
}

async function getCoordinatesFromAddress(address: string): Promise<{ latitude: number, longitude: number }> {
  try {
    // Use Open-Meteo's geocoding API (free, no API key required)
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`
    
    console.log(`🗺️ Geocoding address: ${address}`)
    
    const response = await fetch(geocodeUrl)
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      throw new Error('Address not found')
    }
    
    const result = data.results[0]
    console.log(`🗺️ Found coordinates: ${result.latitude}, ${result.longitude} for ${result.name}`)
    
    return {
      latitude: result.latitude,
      longitude: result.longitude
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    // Fallback to Hamburg coordinates
    console.log('🗺️ Using fallback coordinates (Hamburg)')
    return {
      latitude: 53.5511,
      longitude: 9.9937
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🌤️ Starting hourly weather data sync...')

    // Get organization address from request or use default
    let organizationAddress = 'Hamburg, Germany' // Default fallback
    
    try {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        
        // Get user and organization
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)
        
        if (!userError && user) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('organization_id')
            .eq('auth_id', user.id)
            .single()
          
          if (userProfile) {
            const { data: organization } = await supabase
              .from('organizations')
              .select('address')
              .eq('id', userProfile.organization_id)
              .single()
            
            if (organization?.address) {
              organizationAddress = organization.address
              console.log(`🏢 Using organization address: ${organizationAddress}`)
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not get organization address, using default')
    }

    // Get coordinates for the address
    const { latitude, longitude } = await getCoordinatesFromAddress(organizationAddress)

    // Hole stündliche Daten für die nächsten 7 Tage
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,surface_pressure&timezone=Europe%2FBerlin&forecast_days=7`

    console.log(`🌤️ Fetching hourly weather data from Open-Meteo API: ${url}`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.hourly || !data.hourly.time) {
      throw new Error('Invalid weather data format')
    }

    const weatherData: WeatherData[] = []
    
    for (let i = 0; i < data.hourly.time.length; i++) {
      const dateTime = new Date(data.hourly.time[i])
      const date = dateTime.toISOString().split('T')[0]
      const hour = dateTime.getHours()

      weatherData.push({
        date,
        hour,
        temperature: Math.round((data.hourly.temperature_2m[i] || 0) * 10) / 10,
        precipitation: Math.round((data.hourly.precipitation[i] || 0) * 10) / 10,
        weatherCode: data.hourly.weather_code[i] || 0,
        windSpeed: Math.round((data.hourly.wind_speed_10m[i] || 0) * 10) / 10,
        humidity: Math.round(data.hourly.relative_humidity_2m[i] || 0),
        pressure: Math.round((data.hourly.surface_pressure[i] || 0) * 10) / 10
      })
    }

    console.log(`🌤️ Successfully loaded ${weatherData.length} hourly weather data points`)

    // Speichere die Wetterdaten in der Datenbank
    const { error: insertError } = await supabase
      .from('weather_data')
      .upsert(
        weatherData.map(w => ({
          date: w.date,
          hour: w.hour,
          temperature: w.temperature,
          precipitation: w.precipitation,
          weather_code: w.weatherCode,
          wind_speed: w.windSpeed,
          humidity: w.humidity,
          pressure: w.pressure,
          updated_at: new Date().toISOString()
        })),
        { 
          onConflict: 'date,hour',
          ignoreDuplicates: false 
        }
      )

    if (insertError) {
      console.error('Error saving weather data:', insertError)
      throw new Error(`Failed to save weather data: ${insertError.message}`)
    }

    console.log(`🌤️ Successfully saved ${weatherData.length} hourly weather data points to database`)

    // Save historical data (only past data, not future forecasts)
    let historicalDataSaved = 0
    try {
      const authHeader = request.headers.get('authorization')
      let organizationId = null
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)
        
        if (!userError && user) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('organization_id')
            .eq('auth_id', user.id)
            .single()
          
          if (userProfile) {
            organizationId = userProfile.organization_id
          }
        }
      }

      if (organizationId) {
        const now = new Date()
        
        // Filter for historical data only (past data, not future forecasts)
        const historicalWeatherData = weatherData.filter(w => {
          const dataDateTime = new Date(`${w.date}T${w.hour.toString().padStart(2, '0')}:00:00`)
          return dataDateTime <= now
        })

        if (historicalWeatherData.length > 0) {
          const { error: historyError } = await supabase
            .from('weather_history')
            .upsert(
              historicalWeatherData.map(w => ({
                organization_id: organizationId,
                location_address: organizationAddress,
                latitude: latitude,
                longitude: longitude,
                recorded_at: new Date(`${w.date}T${w.hour.toString().padStart(2, '0')}:00:00`).toISOString(),
                date: w.date,
                hour: w.hour,
                temperature: w.temperature,
                precipitation: w.precipitation,
                weather_code: w.weatherCode,
                wind_speed: w.windSpeed,
                humidity: w.humidity,
                pressure: w.pressure,
                data_source: 'open-meteo',
                sync_timestamp: new Date().toISOString()
              })),
              { 
                onConflict: 'organization_id,latitude,longitude,recorded_at',
                ignoreDuplicates: true 
              }
            )

          if (historyError) {
            console.error('Error saving weather history:', historyError)
          } else {
            historicalDataSaved = historicalWeatherData.length
            console.log(`📊 Successfully saved ${historicalDataSaved} historical weather data points for organization ${organizationId}`)
          }
        }
      }
    } catch (historyError) {
      console.error('Error processing weather history:', historyError)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${weatherData.length} hourly weather data points`,
      dataPoints: weatherData.length,
      historicalDataPoints: historicalDataSaved,
      dateRange: {
        start: weatherData[0]?.date,
        end: weatherData[weatherData.length - 1]?.date
      }
    })

  } catch (error: any) {
    console.error('Weather sync error:', error)
    return NextResponse.json({ 
      error: 'Failed to sync weather data',
      details: error.message 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('weather_data')
      .select('*')
      .order('date', { ascending: true })
      .order('hour', { ascending: true })

    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch weather data: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error: any) {
    console.error('Weather fetch error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch weather data',
      details: error.message 
    }, { status: 500 })
  }
}
