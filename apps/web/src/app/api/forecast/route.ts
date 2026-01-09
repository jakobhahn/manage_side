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
    // Note: startDate and endDate query params are available but not currently used
    // The forecast always uses the next 14 days from today

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Standard: nächste 14 Tage forecasten (fest auf 14 Tage begrenzt)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const forecastStart = today.toISOString().split('T')[0]
    const forecastEnd = (() => {
      const end = new Date(today)
      end.setDate(end.getDate() + 14)
      return end.toISOString().split('T')[0]
    })()

    console.log(`🔮 Starting forecast for organization ${organizationId}`)
    console.log(`📅 Forecast period: ${forecastStart} to ${forecastEnd}`)

    // 1. Historische Daten laden (letzte 2 Jahre für Trend-Analyse)
    const historicalData = await fetchHistoricalData(organizationId)
    console.log(`📊 Loaded ${historicalData.length} historical data points`)

    // 2. Rollierende 4-Wochen-Basis berechnen (wird pro Wochentag angepasst)
    const rollingBaseline = calculateRollingBaseline(historicalData)
    console.log(`📈 Rolling baseline calculated: €${rollingBaseline.toFixed(2)}`)

    // 3. Trend-Analyse (Wochen- und Monatstrends)
    const trends = calculateTrends(historicalData)
    console.log(`📊 Trends calculated:`, trends)

    // 4. Saisonale Faktoren berechnen
    const seasonalFactors = calculateSeasonalFactors(historicalData)
    console.log(`🗓️ Seasonal factors calculated`)

    // 5. Wetterdaten abrufen (aus weather_history für vergangene Tage, von API für zukünftige)
    const weatherData = await fetchWeatherData(organizationId, forecastStart, forecastEnd)
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

    // 7. Forecasts in Datenbank speichern
    await saveForecasts(organizationId, forecast, weatherData)

    // 8. Vergangene Tage mit Actual-Daten aktualisieren
    await updateForecastsWithActuals(organizationId, forecastStart, forecastEnd)

    // 9. Aktualisierte Forecasts aus DB laden (mit Actuals und Wetterdaten)
    const savedForecasts = await loadForecastsFromDB(organizationId, forecastStart, forecastEnd)
    
    // Merge saved forecasts with generated forecast data
    const mergedForecast = forecast.map(f => {
      const saved = savedForecasts.find(s => s.date === f.date)
      if (saved) {
        // Verwende Wetterdaten aus saved forecast falls vorhanden, sonst aus generated
        const weather = saved.actualWeather || saved.forecastWeather || f.weather
        return {
          ...f,
          actualRevenue: saved.actualRevenue,
          accuracy: saved.accuracy,
          weather: weather ? {
            date: f.date,
            temperature: weather.temperature,
            precipitation: weather.precipitation,
            weatherCode: weather.weatherCode,
            windSpeed: weather.windSpeed,
            humidity: weather.humidity
          } : f.weather
        }
      }
      return f
    })

    // Berechne Gesamt-Accuracy
    const accuracyData = mergedForecast.filter(f => f.accuracy !== undefined)
    const overallAccuracy = accuracyData.length > 0 
      ? accuracyData.reduce((sum, f) => sum + f.accuracy!.percentage, 0) / accuracyData.length
      : 0

    const accuracyRating = overallAccuracy >= 90 ? 'excellent' :
                          overallAccuracy >= 75 ? 'good' :
                          overallAccuracy >= 60 ? 'fair' : 'poor'

    console.log(`🎯 Overall accuracy: ${overallAccuracy.toFixed(1)}% (${accuracyRating})`)

    // Erklärung zur Forecast-Berechnung
    const explanation = generateForecastExplanation(
      rollingBaseline,
      trends,
      seasonalFactors,
      historicalData.length
    )

    return NextResponse.json({
      forecast: mergedForecast,
      metadata: {
        rollingBaseline,
        trends,
        dataPoints: historicalData.length,
        forecastPeriod: { start: forecastStart, end: forecastEnd },
        accuracy: {
          overall: Math.round(overallAccuracy * 100) / 100,
          rating: accuracyRating,
          dataPoints: accuracyData.length,
          totalForecasts: mergedForecast.length
        },
        explanation
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
      .select('amount, refunded_amount, transaction_date, status')
      .eq('organization_id', organizationId)
      .in('status', ['SUCCESSFUL', 'PARTIALLY_REFUNDED']) // Nur erfolgreiche und teilweise rückerstattete
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
  // Berücksichtige nur SUCCESSFUL Transaktionen und ziehe refunded_amount ab
  const dailyRevenue = new Map<string, number>()
  
  allTransactions.forEach(transaction => {
    // Nur erfolgreiche Transaktionen zählen (nicht refunded, cancelled, etc.)
    if (transaction.status !== 'SUCCESSFUL' && transaction.status !== 'PARTIALLY_REFUNDED') {
      return
    }
    
    const date = transaction.transaction_date.split('T')[0]
    const amount = parseFloat(transaction.amount) || 0
    const refunded = parseFloat(transaction.refunded_amount) || 0
    const netAmount = Math.max(0, amount - refunded) // Net amount (amount minus refunds)
    
    dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + netAmount)
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
  // Berechne den Durchschnitt aller historischen Daten als Fallback
  // (wird später durch wochentagsspezifische Berechnung ersetzt)
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

function calculateWeekdayBaseline(historicalData: HistoricalData[], weekday: number): number {
  // Berechne den Durchschnitt für einen spezifischen Wochentag
  // Letzte 4 Wochen (28 Tage) für rollierende Basis
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const weekdayData = historicalData.filter(data => 
    data.weekday === weekday && new Date(data.date) >= fourWeeksAgo
  )

  if (weekdayData.length === 0) {
    // Fallback: Alle Daten für diesen Wochentag (letzte 3 Monate)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    const fallbackData = historicalData.filter(data => 
      data.weekday === weekday && new Date(data.date) >= threeMonthsAgo
    )
    
    if (fallbackData.length > 0) {
      return fallbackData.reduce((sum, data) => sum + data.revenue, 0) / fallbackData.length
    }
    
    // Letzter Fallback: Alle Daten für diesen Wochentag
    const allWeekdayData = historicalData.filter(data => data.weekday === weekday)
    if (allWeekdayData.length > 0) {
      return allWeekdayData.reduce((sum, data) => sum + data.revenue, 0) / allWeekdayData.length
    }
    
    // Wenn keine Daten für diesen Wochentag: Gesamtdurchschnitt
    return calculateRollingBaseline(historicalData)
  }

  return weekdayData.reduce((sum, data) => sum + data.revenue, 0) / weekdayData.length
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
  const totalAvg = historicalData.length > 0
    ? historicalData.reduce((sum, data) => sum + data.revenue, 0) / historicalData.length
    : 0

  // Berechne saisonale Faktoren (Multiplikatoren)
  for (let i = 0; i < 7; i++) {
    const weekdayAvg = weekdayCounts[i] > 0 ? weekdayTotals[i] / weekdayCounts[i] : totalAvg
    factors[i] = totalAvg > 0 ? weekdayAvg / totalAvg : 1
  }

  return factors
}

async function fetchWeatherData(organizationId: string, startDate: string, endDate: string): Promise<WeatherData[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const weatherData: WeatherData[] = []
  
  // Für vergangene Tage: Hole aus weather_history
  if (start < today) {
    const pastEnd = new Date(today)
    pastEnd.setDate(pastEnd.getDate() - 1)
    const pastEndStr = pastEnd.toISOString().split('T')[0]
    
    const { data: historicalWeather, error } = await supabase
      .from('weather_history')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('date', startDate)
      .lte('date', pastEndStr)
      .order('date', { ascending: true })
      .order('hour', { ascending: true })

    if (!error && historicalWeather && historicalWeather.length > 0) {
      // Aggregiere stündliche Daten zu täglichen Durchschnittswerten
      const dailyData = new Map<string, WeatherData>()
      
      historicalWeather.forEach((row: any) => {
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
        const hourCount = historicalWeather.filter((row: any) => row.date === date).length
        if (hourCount > 0) {
          dayData.temperature = Math.round((dayData.temperature / hourCount) * 10) / 10
          dayData.windSpeed = Math.round((dayData.windSpeed / hourCount) * 10) / 10
          dayData.humidity = Math.round(dayData.humidity / hourCount)
          // Niederschlag bleibt als Summe
          dayData.precipitation = Math.round(dayData.precipitation * 10) / 10
        }
        weatherData.push(dayData)
      })
      
      console.log(`🌤️ Loaded ${weatherData.length} days of historical weather from DB`)
    }
  }
  
  // Für zukünftige Tage (heute und später): Hole von API
  const futureStart = start < today ? todayStr : startDate
  if (end >= today) {
    const forecastWeather = await fetchWeatherDataFromAPI(futureStart, endDate)
    
    // Speichere Forecast-Wetterdaten in weather_history (als Forecast markiert)
    if (forecastWeather.length > 0) {
      await saveForecastWeatherToHistory(organizationId, forecastWeather)
    }
    
    weatherData.push(...forecastWeather)
    console.log(`🌤️ Loaded ${forecastWeather.length} days of forecast weather from API`)
  }
  
  return weatherData.sort((a, b) => a.date.localeCompare(b.date))
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
      // Nur Daten für den gewünschten Zeitraum
      if (date < startDate || date > endDate) continue
      
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
    return []
  }
}

async function saveForecastWeatherToHistory(organizationId: string, weatherData: WeatherData[]) {
  try {
    // Get organization address
    const { data: organization } = await supabase
      .from('organizations')
      .select('address')
      .eq('id', organizationId)
      .single()

    const address = organization?.address || 'Hamburg, Germany'
    const latitude = 53.5511
    const longitude = 9.9937

    // Für jeden Tag: Erstelle stündliche Einträge (12:00 Uhr als Repräsentant)
    const records = []
    for (const day of weatherData) {
      const recordedAt = new Date(`${day.date}T12:00:00`)
      records.push({
        organization_id: organizationId,
        location_address: address,
        latitude,
        longitude,
        recorded_at: recordedAt.toISOString(),
        date: day.date,
        hour: 12,
        temperature: day.temperature,
        precipitation: day.precipitation,
        weather_code: day.weatherCode,
        wind_speed: day.windSpeed,
        humidity: day.humidity,
        pressure: 0,
        data_source: 'open-meteo-forecast',
        sync_timestamp: new Date().toISOString()
      })
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from('weather_history')
        .upsert(records, {
          onConflict: 'organization_id,latitude,longitude,recorded_at',
          ignoreDuplicates: false
        })

      if (error) {
        console.error('Error saving forecast weather to history:', error)
      } else {
        console.log(`📊 Saved ${records.length} forecast weather records to history`)
      }
    }
  } catch (error) {
    console.error('Error saving forecast weather:', error)
  }
}

function generateForecast(
  startDate: string,
  endDate: string,
  _baseline: number,
  trends: any,
  _seasonalFactors: { [weekday: number]: number },
  historicalData: HistoricalData[],
  weatherData: WeatherData[]
): ForecastData[] {
  const forecast: ForecastData[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0]
    const weekday = date.getDay()

    // Basis-Forecast: Wochentagsspezifischer Durchschnitt (statt allgemeiner Durchschnitt * saisonaler Faktor)
    const weekdayBaseline = calculateWeekdayBaseline(historicalData, weekday)
    let forecastedRevenue = weekdayBaseline

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

    forecast.push({
      date: dateStr,
      forecastedRevenue: Math.round(forecastedRevenue * 100) / 100,
      confidence: Math.round(confidence),
      trend,
      factors: {
        historicalAverage: weekdayBaseline, // Wochentagsspezifischer Durchschnitt
        weeklyTrend: trends.weekly,
        monthlyTrend: trends.monthly,
        seasonalFactor: 1.0, // Nicht mehr verwendet, da Baseline bereits wochentagsspezifisch ist
        weatherFactor
      },
      weather
    })
  }

  return forecast
}

async function saveForecasts(organizationId: string, forecast: ForecastData[], weatherData: WeatherData[]) {
  try {
    const records = forecast.map(f => {
      const weather = weatherData.find(w => w.date === f.date)
      return {
        organization_id: organizationId,
        forecast_date: f.date,
        forecasted_revenue: f.forecastedRevenue,
        confidence: f.confidence,
        trend: f.trend,
        historical_average: f.factors.historicalAverage,
        weekly_trend: f.factors.weeklyTrend,
        monthly_trend: f.factors.monthlyTrend,
        seasonal_factor: f.factors.seasonalFactor,
        weather_factor: f.factors.weatherFactor,
        forecast_weather: weather ? {
          temperature: weather.temperature,
          precipitation: weather.precipitation,
          weatherCode: weather.weatherCode,
          windSpeed: weather.windSpeed,
          humidity: weather.humidity
        } : null
      }
    })

    const { error } = await supabase
      .from('forecasts')
      .upsert(records, {
        onConflict: 'organization_id,forecast_date',
        ignoreDuplicates: false
      })

    if (error) {
      console.error('Error saving forecasts:', error)
    } else {
      console.log(`💾 Saved ${records.length} forecasts to database`)
    }
  } catch (error) {
    console.error('Error saving forecasts:', error)
  }
}

async function updateForecastsWithActuals(organizationId: string, startDate: string, endDate: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Hole alle Forecasts für vergangene Tage
    const { data: forecasts, error: forecastError } = await supabase
      .from('forecasts')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('forecast_date', startDate)
      .lt('forecast_date', todayStr)

    if (forecastError || !forecasts) {
      console.error('Error fetching forecasts for update:', forecastError)
      return
    }

    // Hole tatsächliche Umsätze für diese Tage
    const { data: transactions, error: transactionError } = await supabase
      .from('payment_transactions')
      .select('amount, refunded_amount, transaction_date, status')
      .eq('organization_id', organizationId)
      .in('status', ['SUCCESSFUL', 'PARTIALLY_REFUNDED']) // Nur erfolgreiche und teilweise rückerstattete
      .gte('transaction_date', startDate + 'T00:00:00')
      .lt('transaction_date', todayStr + 'T00:00:00')

    if (transactionError) {
      console.error('Error fetching transactions:', transactionError)
      return
    }

    // Gruppiere Transaktionen nach Datum
    // Berücksichtige nur SUCCESSFUL Transaktionen und ziehe refunded_amount ab
    const dailyRevenue = new Map<string, number>()
    transactions?.forEach(transaction => {
      // Nur erfolgreiche Transaktionen zählen (nicht refunded, cancelled, etc.)
      if (transaction.status !== 'SUCCESSFUL' && transaction.status !== 'PARTIALLY_REFUNDED') {
        return
      }
      
      const date = transaction.transaction_date.split('T')[0]
      const amount = parseFloat(transaction.amount) || 0
      const refunded = parseFloat(transaction.refunded_amount) || 0
      const netAmount = Math.max(0, amount - refunded) // Net amount (amount minus refunds)
      
      dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + netAmount)
    })

    // Hole tatsächliche Wetterdaten aus weather_history
    const { data: actualWeather, error: weatherError } = await supabase
      .from('weather_history')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('date', startDate)
      .lt('date', todayStr)
      .order('date', { ascending: true })
      .order('hour', { ascending: true })

    // Aggregiere Wetterdaten
    const dailyWeather = new Map<string, any>()
    if (!weatherError && actualWeather) {
      actualWeather.forEach((row: any) => {
        const date = row.date
        if (!dailyWeather.has(date)) {
          dailyWeather.set(date, {
            temperature: 0,
            precipitation: 0,
            weatherCode: row.weather_code,
            windSpeed: 0,
            humidity: 0,
            count: 0
          })
        }
        const dayData = dailyWeather.get(date)!
        dayData.temperature += row.temperature
        dayData.precipitation += row.precipitation
        dayData.windSpeed += row.wind_speed
        dayData.humidity += row.humidity
        dayData.count++
      })
    }

    // Aktualisiere Forecasts mit Actuals
    const updates = []
    for (const forecast of forecasts) {
      const actualRevenue = dailyRevenue.get(forecast.forecast_date)
      const actualWeatherData = dailyWeather.get(forecast.forecast_date)
      
      if (actualRevenue !== undefined || actualWeatherData) {
        let accuracy = null
        if (actualRevenue !== undefined) {
          const difference = Math.abs(forecast.forecasted_revenue - actualRevenue)
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

        const updateData: any = {
          actual_revenue: actualRevenue || null,
          actual_updated_at: new Date().toISOString()
        }

        if (actualWeatherData) {
          const count = actualWeatherData.count
          updateData.actual_weather = {
            temperature: Math.round((actualWeatherData.temperature / count) * 10) / 10,
            precipitation: Math.round(actualWeatherData.precipitation * 10) / 10,
            weatherCode: actualWeatherData.weatherCode,
            windSpeed: Math.round((actualWeatherData.windSpeed / count) * 10) / 10,
            humidity: Math.round(actualWeatherData.humidity / count)
          }
        }

        if (accuracy) {
          updateData.accuracy_percentage = accuracy.percentage
          updateData.accuracy_difference = accuracy.difference
          updateData.accuracy_rating = accuracy.rating
        }

        updates.push({
          id: forecast.id,
          ...updateData
        })
      }
    }

    // Führe Updates aus
    if (updates.length > 0) {
      for (const update of updates) {
        const { id, ...updateData } = update
        const { error } = await supabase
          .from('forecasts')
          .update(updateData)
          .eq('id', id)

        if (error) {
          console.error(`Error updating forecast ${id}:`, error)
        }
      }
      console.log(`✅ Updated ${updates.length} forecasts with actual data`)
    }
  } catch (error) {
    console.error('Error updating forecasts with actuals:', error)
  }
}

async function loadForecastsFromDB(organizationId: string, startDate: string, endDate: string): Promise<Array<{ date: string, actualRevenue?: number, accuracy?: any, forecastWeather?: any, actualWeather?: any }>> {
  try {
    const { data, error } = await supabase
      .from('forecasts')
      .select('forecast_date, actual_revenue, accuracy_percentage, accuracy_difference, accuracy_rating, forecast_weather, actual_weather')
      .eq('organization_id', organizationId)
      .gte('forecast_date', startDate)
      .lte('forecast_date', endDate)

    if (error) {
      console.error('Error loading forecasts from DB:', error)
      return []
    }

    return (data || []).map(f => ({
      date: f.forecast_date,
      actualRevenue: f.actual_revenue,
      forecastWeather: f.forecast_weather,
      actualWeather: f.actual_weather,
      accuracy: f.accuracy_percentage ? {
        percentage: f.accuracy_percentage,
        difference: f.accuracy_difference,
        rating: f.accuracy_rating
      } : undefined
    }))
  } catch (error) {
    console.error('Error loading forecasts:', error)
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

function generateForecastExplanation(
  baseline: number,
  trends: any,
  seasonalFactors: { [weekday: number]: number },
  historicalDataPoints: number
): string {
  const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  
  // Finde stärkste und schwächste Wochentage
  const weekdayFactors = Object.entries(seasonalFactors)
    .map(([day, factor]) => ({ day: parseInt(day), factor, name: weekdayNames[parseInt(day)] }))
    .sort((a, b) => b.factor - a.factor)
  
  const strongestDay = weekdayFactors[0]
  const weakestDay = weekdayFactors[weekdayFactors.length - 1]
  
  let explanation = `Die Prognose basiert auf ${historicalDataPoints} historischen Datenpunkten der letzten 2 Jahre. `
  
  explanation += `Der Basiswert (Durchschnitt der letzten 4 Wochen) beträgt €${baseline.toFixed(2)}. `
  
  if (trends.overall > 5) {
    explanation += `Es gibt einen positiven Trend von ${trends.overall.toFixed(1)}%, der in die Prognose einfließt. `
  } else if (trends.overall < -5) {
    explanation += `Es gibt einen negativen Trend von ${trends.overall.toFixed(1)}%, der in die Prognose einfließt. `
  } else {
    explanation += `Der Trend ist stabil (${trends.overall.toFixed(1)}%). `
  }
  
  explanation += `Wochentage werden unterschiedlich gewichtet: ${strongestDay.name} ist der stärkste Tag (Faktor ${strongestDay.factor.toFixed(2)}x), `
  explanation += `${weakestDay.name} der schwächste (Faktor ${weakestDay.factor.toFixed(2)}x). `
  
  explanation += `Zusätzlich werden Wetterdaten berücksichtigt: Regen, Kälte oder Hitze reduzieren den erwarteten Umsatz, `
  explanation += `während sonniges Wetter ihn erhöht. `
  
  explanation += `Die Prognose wird täglich aktualisiert und mit tatsächlichen Werten verglichen, um die Genauigkeit zu verbessern.`
  
  return explanation
}
