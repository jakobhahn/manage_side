import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WeatherData {
  date: string
  temperature: number
  precipitation: number
  weatherCode: number
  windSpeed: number
  humidity: number
}

interface ForecastData {
  date: string
  forecastedRevenue: number
  actualRevenue?: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
  accuracy?: {
    percentage: number
    difference: number
    rating: 'excellent' | 'good' | 'fair' | 'poor'
  }
  factors: {
    historicalAverage: number
    weeklyTrend: number
    monthlyTrend: number
    seasonalFactor: number
    weatherFactor: number
  }
  weather?: WeatherData
}

interface HistoricalData {
  date: string
  revenue: number
  weekday: number
  week: number
  month: number
  year: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Standard: nächste 30 Tage forecasten
    const forecastStart = startDate || new Date().toISOString().split('T')[0]
    const forecastEnd = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`🔮 Starting forecast for organization ${organizationId}`)
    console.log(`📅 Forecast period: ${forecastStart} to ${forecastEnd}`)

    // 1. Historische Daten laden (letzte 2 Jahre für Trend-Analyse)
    const historicalData = await fetchHistoricalData(organizationId)
    console.log(`📊 Loaded ${historicalData.length} historical data points`)

    // 2. Rollierende 4-Wochen-Basis berechnen
    const rollingBaseline = calculateRollingBaseline(historicalData)
    console.log(`📈 Rolling baseline calculated: €${rollingBaseline.toFixed(2)}`)

    // 3. Trend-Analyse (Wochen- und Monatstrends)
    const trends = calculateTrends(historicalData)
    console.log(`📊 Trends calculated:`, trends)

    // 4. Saisonale Faktoren berechnen
    const seasonalFactors = calculateSeasonalFactors(historicalData)
    console.log(`🗓️ Seasonal factors calculated`)

    // 5. Wetterdaten abrufen (erst aus DB, dann von API falls nötig)
    const weatherData = await fetchWeatherDataFromDB(forecastStart, forecastEnd)
    console.log(`🌤️ Weather data loaded for ${weatherData.length} days`)

    // 6. Forecast für jeden Tag im Zeitraum generieren
    const forecast = generateForecast(
      forecastStart,
      forecastEnd,
      rollingBaseline,
      trends,
      seasonalFactors,
      historicalData,
      weatherData
    )

    console.log(`🔮 Generated ${forecast.length} forecast points`)

    // Berechne Gesamt-Accuracy
    const accuracyData = forecast.filter(f => f.accuracy !== undefined)
    const overallAccuracy = accuracyData.length > 0 
      ? accuracyData.reduce((sum, f) => sum + f.accuracy!.percentage, 0) / accuracyData.length
      : 0

    const accuracyRating = overallAccuracy >= 90 ? 'excellent' :
                          overallAccuracy >= 75 ? 'good' :
                          overallAccuracy >= 60 ? 'fair' : 'poor'

    console.log(`🎯 Overall accuracy: ${overallAccuracy.toFixed(1)}% (${accuracyRating})`)

    return NextResponse.json({
      forecast,
      metadata: {
        rollingBaseline,
        trends,
        dataPoints: historicalData.length,
        forecastPeriod: { start: forecastStart, end: forecastEnd },
        accuracy: {
          overall: Math.round(overallAccuracy * 100) / 100,
          rating: accuracyRating,
          dataPoints: accuracyData.length,
          totalForecasts: forecast.length
        }
      }
    })

  } catch (error) {
    console.error('Forecast API error:', error)
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 })
  }
}

async function fetchHistoricalData(organizationId: string): Promise<HistoricalData[]> {
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  let allTransactions: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data: transactions, error } = await supabase
      .from('payment_transactions')
      .select('amount, transaction_date')
      .eq('organization_id', organizationId)
      .eq('status', 'SUCCESSFUL')
      .gte('transaction_date', twoYearsAgo.toISOString())
      .order('transaction_date', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error('Error fetching historical data:', error)
      break
    }

    if (!transactions || transactions.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...transactions]
      hasMore = transactions.length === pageSize
      page++
    }

    if (page > 50) break // Safety limit
  }

  // Gruppiere nach Tagen und berechne tägliche Umsätze
  const dailyRevenue = new Map<string, number>()
  
  allTransactions.forEach(transaction => {
    const date = transaction.transaction_date.split('T')[0]
    const amount = parseFloat(transaction.amount) || 0
    dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + amount)
  })

  // Konvertiere zu HistoricalData Array
  return Array.from(dailyRevenue.entries()).map(([date, revenue]) => {
    const dateObj = new Date(date)
    return {
      date,
      revenue,
      weekday: dateObj.getDay(),
      week: getWeekNumber(dateObj),
      month: dateObj.getMonth() + 1,
      year: dateObj.getFullYear()
    }
  })
}

function calculateRollingBaseline(historicalData: HistoricalData[]): number {
  // Letzte 4 Wochen (28 Tage) für rollierende Basis
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const recentData = historicalData.filter(data => 
    new Date(data.date) >= fourWeeksAgo
  )

  if (recentData.length === 0) {
    // Fallback: Durchschnitt der letzten 3 Monate
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    const fallbackData = historicalData.filter(data => 
      new Date(data.date) >= threeMonthsAgo
    )
    
    return fallbackData.length > 0 
      ? fallbackData.reduce((sum, data) => sum + data.revenue, 0) / fallbackData.length
      : 0
  }

  return recentData.reduce((sum, data) => sum + data.revenue, 0) / recentData.length
}

function calculateTrends(historicalData: HistoricalData[]) {
  // Wochentrend: Vergleich der letzten 4 Wochen mit den 4 Wochen davor
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const olderPeriod = historicalData.filter(data => {
    const date = new Date(data.date)
    return date >= eightWeeksAgo && date < fourWeeksAgo
  })

  const recentPeriod = historicalData.filter(data => {
    const date = new Date(data.date)
    return date >= fourWeeksAgo
  })

  const olderAvg = olderPeriod.length > 0 
    ? olderPeriod.reduce((sum, data) => sum + data.revenue, 0) / olderPeriod.length
    : 0

  const recentAvg = recentPeriod.length > 0
    ? recentPeriod.reduce((sum, data) => sum + data.revenue, 0) / recentPeriod.length
    : 0

  const weeklyTrend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0

  // Monatstrend: Vergleich der letzten 3 Monate
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const olderMonths = historicalData.filter(data => {
    const date = new Date(data.date)
    return date >= sixMonthsAgo && date < threeMonthsAgo
  })

  const recentMonths = historicalData.filter(data => {
    const date = new Date(data.date)
    return date >= threeMonthsAgo
  })

  const olderMonthlyAvg = olderMonths.length > 0
    ? olderMonths.reduce((sum, data) => sum + data.revenue, 0) / olderMonths.length
    : 0

  const recentMonthlyAvg = recentMonths.length > 0
    ? recentMonths.reduce((sum, data) => sum + data.revenue, 0) / recentMonths.length
    : 0

  const monthlyTrend = olderMonthlyAvg > 0 
    ? ((recentMonthlyAvg - olderMonthlyAvg) / olderMonthlyAvg) * 100 
    : 0

  return {
    weekly: weeklyTrend,
    monthly: monthlyTrend,
    overall: (weeklyTrend + monthlyTrend) / 2
  }
}

function calculateSeasonalFactors(historicalData: HistoricalData[]) {
  const factors: { [weekday: number]: number } = {}
  const weekdayTotals: { [weekday: number]: number } = {}
  const weekdayCounts: { [weekday: number]: number } = {}

  // Initialisiere Arrays
  for (let i = 0; i < 7; i++) {
    weekdayTotals[i] = 0
    weekdayCounts[i] = 0
  }

  // Berechne Durchschnitt pro Wochentag
  historicalData.forEach(data => {
    weekdayTotals[data.weekday] += data.revenue
    weekdayCounts[data.weekday]++
  })

  // Berechne Gesamtdurchschnitt
  const totalAvg = historicalData.reduce((sum, data) => sum + data.revenue, 0) / historicalData.length

  // Berechne saisonale Faktoren (Multiplikatoren)
  for (let i = 0; i < 7; i++) {
    const weekdayAvg = weekdayCounts[i] > 0 ? weekdayTotals[i] / weekdayCounts[i] : totalAvg
    factors[i] = totalAvg > 0 ? weekdayAvg / totalAvg : 1
  }

  return factors
}

function generateForecast(
  startDate: string,
  endDate: string,
  baseline: number,
  trends: any,
  seasonalFactors: { [weekday: number]: number },
  historicalData: HistoricalData[],
  weatherData: WeatherData[]
): ForecastData[] {
  const forecast: ForecastData[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0]
    const weekday = date.getDay()

    // Basis-Forecast mit saisonalem Faktor
    let forecastedRevenue = baseline * seasonalFactors[weekday]

    // Trend-Anpassung (konservativ)
    const trendAdjustment = 1 + (trends.overall / 100) * 0.3 // Maximal 30% des Trends
    forecastedRevenue *= trendAdjustment

    // Wetter-Faktor anwenden
    const weather = weatherData.find(w => w.date === dateStr)
    let weatherFactor = 1.0
    if (weather) {
      weatherFactor = calculateWeatherFactor(weather)
      forecastedRevenue *= weatherFactor
    }

    // Confidence basierend auf verfügbaren historischen Daten
    const historicalDays = historicalData.filter(data => data.weekday === weekday).length
    const confidence = Math.min(95, Math.max(50, (historicalDays / 10) * 100))

    // Trend-Direction
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (trends.overall > 5) trend = 'up'
    else if (trends.overall < -5) trend = 'down'

    // Prüfe ob es bereits tatsächliche Daten für diesen Tag gibt
    const actualData = historicalData.find(data => data.date === dateStr)
    const actualRevenue = actualData?.revenue

    // Berechne Accuracy wenn tatsächliche Daten vorhanden sind
    let accuracy = undefined
    if (actualRevenue !== undefined) {
      const difference = Math.abs(forecastedRevenue - actualRevenue)
      const percentage = actualRevenue > 0 ? (1 - (difference / actualRevenue)) * 100 : 0
      
      let rating: 'excellent' | 'good' | 'fair' | 'poor'
      if (percentage >= 90) rating = 'excellent'
      else if (percentage >= 75) rating = 'good'
      else if (percentage >= 60) rating = 'fair'
      else rating = 'poor'
      
      accuracy = {
        percentage: Math.round(percentage * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        rating
      }
    }

    forecast.push({
      date: dateStr,
      forecastedRevenue: Math.round(forecastedRevenue * 100) / 100,
      actualRevenue,
      confidence: Math.round(confidence),
      trend,
      accuracy,
      factors: {
        historicalAverage: baseline,
        weeklyTrend: trends.weekly,
        monthlyTrend: trends.monthly,
        seasonalFactor: seasonalFactors[weekday],
        weatherFactor
      },
      weather
    })
  }

  return forecast
}

async function fetchWeatherDataFromDB(startDate: string, endDate: string): Promise<WeatherData[]> {
  try {
    // Erst versuchen, Daten aus der Datenbank zu holen
    const { data: dbWeatherData, error } = await supabase
      .from('weather_data')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('hour', { ascending: true })

    if (error) {
      console.error('Error fetching weather data from DB:', error)
      // Fallback zu API
      return await fetchWeatherDataFromAPI(startDate, endDate)
    }

    if (!dbWeatherData || dbWeatherData.length === 0) {
      console.log('No weather data in DB, fetching from API...')
      // Keine Daten in DB, hole von API
      return await fetchWeatherDataFromAPI(startDate, endDate)
    }

    // Konvertiere DB-Daten zu WeatherData Format
    const weatherData: WeatherData[] = []
    const dailyData = new Map<string, WeatherData>()

    // Aggregiere stündliche Daten zu täglichen Durchschnittswerten
    dbWeatherData.forEach((row: any) => {
      const date = row.date
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          date,
          temperature: 0,
          precipitation: 0,
          weatherCode: row.weather_code,
          windSpeed: 0,
          humidity: 0
        })
      }

      const dayData = dailyData.get(date)!
      dayData.temperature += row.temperature
      dayData.precipitation += row.precipitation
      dayData.windSpeed += row.wind_speed
      dayData.humidity += row.humidity
    })

    // Berechne Durchschnittswerte
    dailyData.forEach((dayData, date) => {
      const hourCount = dbWeatherData.filter((row: any) => row.date === date).length
      if (hourCount > 0) {
        dayData.temperature = Math.round((dayData.temperature / hourCount) * 10) / 10
        dayData.windSpeed = Math.round((dayData.windSpeed / hourCount) * 10) / 10
        dayData.humidity = Math.round(dayData.humidity / hourCount)
        // Niederschlag bleibt als Summe
        dayData.precipitation = Math.round(dayData.precipitation * 10) / 10
      }
      weatherData.push(dayData)
    })

    console.log(`🌤️ Successfully loaded ${weatherData.length} weather data points from database`)
    return weatherData

  } catch (error) {
    console.error('Error fetching weather data from DB:', error)
    // Fallback zu API
    return await fetchWeatherDataFromAPI(startDate, endDate)
  }
}

async function fetchWeatherDataFromAPI(startDate: string, endDate: string): Promise<WeatherData[]> {
  try {
    // Hamburg, Seilerstraße 40 Koordinaten
    const latitude = 53.5511
    const longitude = 9.9937

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,relative_humidity_2m_max&timezone=Europe%2FBerlin&forecast_days=${Math.min(days, 16)}`

    console.log(`🌤️ Fetching weather data from Open-Meteo API: ${url}`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.daily || !data.daily.time) {
      throw new Error('Invalid weather data format')
    }

    const weatherData: WeatherData[] = []
    
    for (let i = 0; i < data.daily.time.length; i++) {
      const date = data.daily.time[i]
      const temperature = (data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2
      const precipitation = data.daily.precipitation_sum[i] || 0
      const weatherCode = data.daily.weather_code[i]
      const windSpeed = data.daily.wind_speed_10m_max[i] || 0
      const humidity = data.daily.relative_humidity_2m_max[i] || 0

      weatherData.push({
        date,
        temperature: Math.round(temperature * 10) / 10,
        precipitation: Math.round(precipitation * 10) / 10,
        weatherCode,
        windSpeed: Math.round(windSpeed * 10) / 10,
        humidity: Math.round(humidity)
      })
    }

    console.log(`🌤️ Successfully loaded ${weatherData.length} weather data points from API`)
    return weatherData

  } catch (error) {
    console.error('Error fetching weather data from API:', error)
    // Fallback: Return empty weather data
    return []
  }
}

function calculateWeatherFactor(weather: WeatherData): number {
  let factor = 1.0

  // Temperatur-Einfluss (optimal bei 15-25°C)
  if (weather.temperature < 5) {
    factor *= 0.7 // Sehr kalt - weniger Gäste
  } else if (weather.temperature < 10) {
    factor *= 0.85 // Kalt - weniger Gäste
  } else if (weather.temperature > 30) {
    factor *= 0.8 // Sehr heiß - weniger Gäste
  } else if (weather.temperature > 25) {
    factor *= 0.9 // Heiß - etwas weniger Gäste
  }

  // Niederschlag-Einfluss
  if (weather.precipitation > 10) {
    factor *= 0.6 // Starker Regen - deutlich weniger Gäste
  } else if (weather.precipitation > 5) {
    factor *= 0.75 // Regen - weniger Gäste
  } else if (weather.precipitation > 1) {
    factor *= 0.9 // Leichter Regen - etwas weniger Gäste
  }

  // Wind-Einfluss
  if (weather.windSpeed > 15) {
    factor *= 0.85 // Starker Wind - weniger Gäste
  } else if (weather.windSpeed > 10) {
    factor *= 0.95 // Wind - etwas weniger Gäste
  }

  // Wetter-Code-Einfluss (basierend auf WMO Weather interpretation codes)
  if (weather.weatherCode >= 80) {
    // Regen, Gewitter, etc.
    factor *= 0.7
  } else if (weather.weatherCode >= 60) {
    // Leichter Regen
    factor *= 0.85
  } else if (weather.weatherCode >= 40) {
    // Nebel, Dunst
    factor *= 0.95
  } else if (weather.weatherCode >= 20) {
    // Bewölkt
    factor *= 1.0
  } else if (weather.weatherCode >= 10) {
    // Teilweise bewölkt
    factor *= 1.05
  } else {
    // Klar/Sonnig
    factor *= 1.1
  }

  return Math.round(factor * 100) / 100
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}
