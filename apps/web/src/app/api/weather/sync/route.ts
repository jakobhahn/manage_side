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

export async function POST(_request: NextRequest) {
  try {
    console.log('🌤️ Starting hourly weather data sync...')

    // Hamburg, Seilerstraße 40 Koordinaten
    const latitude = 53.5511
    const longitude = 9.9937

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

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${weatherData.length} hourly weather data points`,
      dataPoints: weatherData.length,
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
