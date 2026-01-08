import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date required' }, { status: 400 })
    }

    // Hole vergangene Forecasts aus der Datenbank
    const { data: forecasts, error } = await supabase
      .from('forecasts')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('forecast_date', startDate)
      .lte('forecast_date', endDate)
      .order('forecast_date', { ascending: true })

    if (error) {
      console.error('Error fetching past forecasts:', error)
      return NextResponse.json({ error: 'Failed to fetch past forecasts' }, { status: 500 })
    }

    // Konvertiere zu ForecastData Format
    const forecastData = (forecasts || []).map(f => {
      const forecastWeather = f.forecast_weather || {}
      const actualWeather = f.actual_weather || forecastWeather

      return {
        date: f.forecast_date,
        forecastedRevenue: parseFloat(f.forecasted_revenue) || 0,
        actualRevenue: f.actual_revenue ? parseFloat(f.actual_revenue) : undefined,
        confidence: parseFloat(f.confidence) || 0,
        trend: f.trend as 'up' | 'down' | 'stable',
        accuracy: f.accuracy_percentage ? {
          percentage: parseFloat(f.accuracy_percentage),
          difference: parseFloat(f.accuracy_difference || 0),
          rating: f.accuracy_rating as 'excellent' | 'good' | 'fair' | 'poor'
        } : undefined,
        factors: {
          historicalAverage: parseFloat(f.historical_average) || 0,
          weeklyTrend: parseFloat(f.weekly_trend) || 0,
          monthlyTrend: parseFloat(f.monthly_trend) || 0,
          seasonalFactor: parseFloat(f.seasonal_factor) || 0,
          weatherFactor: parseFloat(f.weather_factor) || 0
        },
        weather: actualWeather.temperature !== undefined ? {
          date: f.forecast_date,
          temperature: parseFloat(actualWeather.temperature) || 0,
          precipitation: parseFloat(actualWeather.precipitation) || 0,
          weatherCode: parseInt(actualWeather.weatherCode) || 0,
          windSpeed: parseFloat(actualWeather.windSpeed) || 0,
          humidity: parseInt(actualWeather.humidity) || 0
        } : undefined
      }
    })

    return NextResponse.json({
      forecasts: forecastData,
      count: forecastData.length
    })

  } catch (error) {
    console.error('Past forecasts API error:', error)
    return NextResponse.json({ error: 'Failed to fetch past forecasts' }, { status: 500 })
  }
}



