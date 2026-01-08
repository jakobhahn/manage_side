import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper function to get organization info from request
async function getOrganizationInfo(request: NextRequest): Promise<{ organizationId: string | null, address: string }> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { organizationId: null, address: 'Hamburg, Germany' }
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return { organizationId: null, address: 'Hamburg, Germany' }
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single()
    
    if (!userProfile) {
      return { organizationId: null, address: 'Hamburg, Germany' }
    }

    const { data: organization } = await supabase
      .from('organizations')
      .select('address')
      .eq('id', userProfile.organization_id)
      .single()
    
    return {
      organizationId: userProfile.organization_id,
      address: organization?.address || 'Hamburg, Germany'
    }
  } catch (error) {
    console.log('⚠️ Could not get organization info, using default')
    return { organizationId: null, address: 'Hamburg, Germany' }
  }
}

// Helper function to save weather data to history
async function saveWeatherToHistory(
  organizationId: string | null,
  address: string,
  latitude: number,
  longitude: number,
  weatherData: Array<{
    recorded_at: string
    date: string
    hour: number
    temperature: number
    precipitation: number
    weatherCode: number
    windSpeed: number
    humidity: number
    pressure?: number
  }>
) {
  if (!organizationId || weatherData.length === 0) {
    return
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Filter out future data (only save current/past data)
    const now = new Date()
    const historicalData = weatherData.filter(w => {
      const dataDateTime = new Date(w.recorded_at)
      return dataDateTime <= now
    })

    if (historicalData.length > 0) {
      const { error: historyError } = await supabase
        .from('weather_history')
        .upsert(
          historicalData.map(w => ({
            organization_id: organizationId,
            location_address: address,
            latitude: latitude,
            longitude: longitude,
            recorded_at: w.recorded_at,
            date: w.date,
            hour: w.hour,
            temperature: w.temperature,
            precipitation: w.precipitation,
            weather_code: w.weatherCode,
            wind_speed: w.windSpeed,
            humidity: w.humidity,
            pressure: w.pressure || 0,
            data_source: 'open-meteo',
            sync_timestamp: new Date().toISOString()
          })),
          { 
            onConflict: 'organization_id,latitude,longitude,recorded_at',
            ignoreDuplicates: false 
          }
        )

      if (historyError) {
        console.error('Error saving weather history:', historyError)
      } else {
        console.log(`📊 Successfully saved ${historicalData.length} weather data points to history`)
      }
    }
  } catch (error) {
    console.error('Error saving weather history:', error)
  }
}

// GET /api/weather/current - Get current weather and 14-day forecast
// GET /api/weather/current?date=2024-01-15 - Get hourly data for a specific date
export async function GET(request: NextRequest) {
  try {
    // Get organization info
    const { organizationId, address } = await getOrganizationInfo(request)
    
    // Hamburg, Seilerstraße 40 Koordinaten
    const latitude = 53.5511
    const longitude = 9.9937

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    // If date is provided, return hourly data for that date
    if (date) {
      // Calculate how many days from today the requested date is
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const requestedDate = new Date(date + 'T00:00:00')
      requestedDate.setHours(0, 0, 0, 0)
      const daysDiff = Math.ceil((requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      // Always fetch at least 16 days to ensure we have data for all forecast days
      // Fetch hourly data and daily sunrise/sunset for the requested date
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weather_code&daily=sunrise,sunset&timezone=Europe%2FBerlin&forecast_days=16`

      console.log(`🌤️ Fetching hourly weather data for date: ${date} (${daysDiff} days from today, forecast_days=16)`)

      const response = await fetch(url)
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Weather API error: ${response.status} - ${errorText}`)
        throw new Error(`Weather API error: ${response.status}: ${errorText.substring(0, 200)}`)
      }

      const data = await response.json()
      
      if (!data.hourly || !data.hourly.time) {
        console.error('Invalid weather data format:', JSON.stringify(data).substring(0, 500))
        throw new Error('Invalid weather data format: missing hourly data')
      }

      // Filter hourly data for the requested date
      const hourlyData = []
      for (let i = 0; i < data.hourly.time.length; i++) {
        const hourDate = data.hourly.time[i].split('T')[0]
        if (hourDate === date) {
          hourlyData.push({
            time: data.hourly.time[i],
            hour: new Date(data.hourly.time[i]).getHours(),
            temperature: Math.round((data.hourly.temperature_2m[i] || 0) * 10) / 10,
            precipitation: Math.round((data.hourly.precipitation[i] || 0) * 10) / 10,
            weatherCode: data.hourly.weather_code[i] || 0
          })
        }
      }

      console.log(`✅ Found ${hourlyData.length} hourly data points for ${date} (total hours in response: ${data.hourly.time.length})`)

      if (hourlyData.length === 0) {
        console.warn(`⚠️ No hourly data found for date ${date}. Available dates:`, 
          [...new Set(data.hourly.time.map((t: string) => t.split('T')[0]))].slice(0, 5))
      }

      // Get sunrise and sunset for the requested date
      let sunrise: string | null = null
      let sunset: string | null = null
      if (data.daily && data.daily.time && data.daily.sunrise && data.daily.sunset) {
        const dateIndex = data.daily.time.indexOf(date)
        if (dateIndex !== -1) {
          sunrise = data.daily.sunrise[dateIndex] || null
          sunset = data.daily.sunset[dateIndex] || null
        }
      }

      // Save hourly data to history (only if organizationId is available)
      if (organizationId && hourlyData.length > 0) {
        // Check if we need wind_speed, humidity, and pressure from the API
        // For now, we'll use default values if not available
        const hourlyWithFullData = hourlyData.map(hour => {
          const hourDate = new Date(hour.time)
          return {
            recorded_at: hourDate.toISOString(),
            date: date,
            hour: hour.hour,
            temperature: hour.temperature,
            precipitation: hour.precipitation,
            weatherCode: hour.weatherCode,
            windSpeed: 0, // Will be updated if we fetch it
            humidity: 0, // Will be updated if we fetch it
            pressure: 0 // Will be updated if we fetch it
          }
        })

        // Map additional data from API response
        for (let i = 0; i < data.hourly.time.length; i++) {
          const hourDate = data.hourly.time[i].split('T')[0]
          if (hourDate === date) {
            const hourIndex = hourlyData.findIndex(h => h.time === data.hourly.time[i])
            if (hourIndex !== -1) {
              if (data.hourly.wind_speed_10m) {
                hourlyWithFullData[hourIndex].windSpeed = Math.round((data.hourly.wind_speed_10m[i] || 0) * 10) / 10
              }
              if (data.hourly.relative_humidity_2m) {
                hourlyWithFullData[hourIndex].humidity = Math.round(data.hourly.relative_humidity_2m[i] || 0)
              }
              if (data.hourly.surface_pressure) {
                hourlyWithFullData[hourIndex].pressure = Math.round((data.hourly.surface_pressure[i] || 0) * 10) / 10
              }
            }
          }
        }

        await saveWeatherToHistory(organizationId, address, latitude, longitude, hourlyWithFullData)
      }

      return NextResponse.json({
        success: true,
        date,
        hourly: hourlyData,
        sunrise,
        sunset
      })
    }

    // Fetch current weather and 14-day forecast (including sunrise/sunset)
    // Also fetch hourly data for the current hour to save to history
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,surface_pressure&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max,sunrise,sunset&timezone=Europe%2FBerlin&forecast_days=14`

    console.log(`🌤️ Fetching current weather and forecast from Open-Meteo API`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.current || !data.daily) {
      throw new Error('Invalid weather data format')
    }

    // Get current weather
    const currentTime = new Date(data.current.time)
    const current = {
      temperature: Math.round(data.current.temperature_2m * 10) / 10,
      humidity: Math.round(data.current.relative_humidity_2m),
      weatherCode: data.current.weather_code,
      windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
      precipitation: Math.round(data.current.precipitation * 10) / 10,
      time: data.current.time
    }

    // Save current weather to history (only if organizationId is available)
    if (organizationId) {
      const currentWeatherData = [{
        recorded_at: currentTime.toISOString(),
        date: currentTime.toISOString().split('T')[0],
        hour: currentTime.getHours(),
        temperature: current.temperature,
        precipitation: current.precipitation,
        weatherCode: current.weatherCode,
        windSpeed: current.windSpeed,
        humidity: current.humidity,
        pressure: 0 // Current API doesn't provide pressure in current data
      }]

      await saveWeatherToHistory(organizationId, address, latitude, longitude, currentWeatherData)
    }

    // Get 14-day forecast
    const forecast = []
    for (let i = 0; i < data.daily.time.length; i++) {
      forecast.push({
        date: data.daily.time[i],
        temperatureMax: Math.round(data.daily.temperature_2m_max[i] * 10) / 10,
        temperatureMin: Math.round(data.daily.temperature_2m_min[i] * 10) / 10,
        weatherCode: data.daily.weather_code[i],
        precipitation: Math.round(data.daily.precipitation_sum[i] * 10) / 10,
        windSpeed: Math.round(data.daily.wind_speed_10m_max[i] * 10) / 10,
        sunrise: data.daily.sunrise ? data.daily.sunrise[i] : null,
        sunset: data.daily.sunset ? data.daily.sunset[i] : null
      })
    }

    // Also save hourly data for today to history (if available and organizationId exists)
    if (organizationId && data.hourly && data.hourly.time) {
      const today = new Date().toISOString().split('T')[0]
      const now = new Date()
      const hourlyHistoryData = []

      for (let i = 0; i < data.hourly.time.length; i++) {
        const hourDate = data.hourly.time[i].split('T')[0]
        const hourDateTime = new Date(data.hourly.time[i])
        
        // Only save data for today and past hours
        if (hourDate === today && hourDateTime <= now) {
          hourlyHistoryData.push({
            recorded_at: hourDateTime.toISOString(),
            date: hourDate,
            hour: hourDateTime.getHours(),
            temperature: Math.round((data.hourly.temperature_2m[i] || 0) * 10) / 10,
            precipitation: Math.round((data.hourly.precipitation[i] || 0) * 10) / 10,
            weatherCode: data.hourly.weather_code[i] || 0,
            windSpeed: Math.round((data.hourly.wind_speed_10m?.[i] || 0) * 10) / 10,
            humidity: Math.round(data.hourly.relative_humidity_2m?.[i] || 0),
            pressure: Math.round((data.hourly.surface_pressure?.[i] || 0) * 10) / 10
          })
        }
      }

      if (hourlyHistoryData.length > 0) {
        await saveWeatherToHistory(organizationId, address, latitude, longitude, hourlyHistoryData)
      }
    }

    return NextResponse.json({
      success: true,
      current,
      forecast
    })

  } catch (error: any) {
    console.error('Weather fetch error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch weather data',
      details: error.message 
    }, { status: 500 })
  }
}

