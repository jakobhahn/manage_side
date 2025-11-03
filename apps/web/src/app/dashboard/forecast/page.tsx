'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar,
  BarChart3,
  Cloud,
  Sun,
  CloudRain
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

interface ForecastResponse {
  forecast: ForecastData[]
  metadata: {
    rollingBaseline: number
    trends: {
      weekly: number
      monthly: number
      overall: number
    }
    dataPoints: number
    forecastPeriod: {
      start: string
      end: string
    }
    accuracy: {
      overall: number
      rating: 'excellent' | 'good' | 'fair' | 'poor'
      dataPoints: number
      totalForecasts: number
    }
  }
}

interface HourlyWeatherData {
  hour: number
  temperature: number
  precipitation: number
  weather_code: number
  wind_speed: number
  humidity: number
  pressure: number
}

export default function ForecastPage() {
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedView, setSelectedView] = useState<'calendar' | 'chart'>('calendar')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hourlyData, setHourlyData] = useState<HourlyWeatherData[]>([])
  const [isLoadingHourly, setIsLoadingHourly] = useState(false)
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    // Set default date range (next 30 days)
    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setDate(nextMonth.getDate() + 30)
    
    setStartDate(today.toISOString().split('T')[0])
    setEndDate(nextMonth.toISOString().split('T')[0])
    
    fetchForecastData()
  }, [])

  const fetchForecastData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Get organization ID
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const orgResponse = await fetch('/api/organizations/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!orgResponse.ok) {
        throw new Error('Failed to fetch organization data')
      }

      const orgData = await orgResponse.json()
      const organizationId = orgData.organization?.id

      if (!organizationId) {
        throw new Error('No organization found')
      }

      // Fetch forecast data
      const forecastStart = startDate || new Date().toISOString().split('T')[0]
      const forecastEnd = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const response = await fetch(
        `/api/forecast?organizationId=${organizationId}&startDate=${forecastStart}&endDate=${forecastEnd}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch forecast data')
      }

      const data = await response.json()
      setForecastData(data)
      console.log('Forecast data loaded:', data)

    } catch (error: any) {
      console.error('Error fetching forecast data:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHourlyData = async (date: string) => {
    try {
      setIsLoadingHourly(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Fetch hourly weather data for the selected date
      const response = await fetch(`/api/weather/sync?startDate=${date}&endDate=${date}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch hourly data')
      }
      
      const data = await response.json()
      
      // Filter data for the specific date and sort by hour
      const dayData = (data.data || [])
        .filter((item: any) => item.date === date)
        .sort((a: any, b: any) => a.hour - b.hour)
      
      setHourlyData(dayData)
    } catch (err) {
      console.error('Error fetching hourly data:', err)
    } finally {
      setIsLoadingHourly(false)
    }
  }

  const handleDayClick = (date: string) => {
    setSelectedDate(date)
    fetchHourlyData(date)
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600'
    if (confidence >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getWeatherIcon = (weather?: WeatherData) => {
    if (!weather) {
      return <Sun className="h-4 w-4 text-yellow-500" />
    }

    // WMO Weather interpretation codes
    if (weather.weatherCode >= 80) {
      // Regen, Gewitter
      return <CloudRain className="h-4 w-4 text-blue-600" />
    } else if (weather.weatherCode >= 60) {
      // Leichter Regen
      return <CloudRain className="h-4 w-4 text-blue-500" />
    } else if (weather.weatherCode >= 40) {
      // Nebel, Dunst
      return <Cloud className="h-4 w-4 text-gray-400" />
    } else if (weather.weatherCode >= 20) {
      // Bewölkt
      return <Cloud className="h-4 w-4 text-gray-500" />
    } else if (weather.weatherCode >= 10) {
      // Teilweise bewölkt
      return <Cloud className="h-4 w-4 text-gray-300" />
    } else {
      // Klar/Sonnig
      return <Sun className="h-4 w-4 text-yellow-500" />
    }
  }

  const getWeatherTooltip = (weather?: WeatherData) => {
    if (!weather) return 'Keine Wetterdaten'
    
    return `${weather.temperature}°C, ${weather.precipitation}mm Regen, ${weather.windSpeed}km/h Wind`
  }

  const getAccuracyColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'text-green-600 bg-green-100'
      case 'good':
        return 'text-blue-600 bg-blue-100'
      case 'fair':
        return 'text-yellow-600 bg-yellow-100'
      case 'poor':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getAccuracyIcon = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return '🎯'
      case 'good':
        return '✅'
      case 'fair':
        return '⚠️'
      case 'poor':
        return '❌'
      default:
        return '❓'
    }
  }

  const renderCalendarView = () => {
    if (!forecastData?.forecast) return null

    const today = new Date()
    const start = new Date(forecastData.metadata.forecastPeriod.start)
    const end = new Date(forecastData.metadata.forecastPeriod.end)

    // Generate calendar grid
    const calendarDays = []
    const current = new Date(start)
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      const forecastDay = forecastData.forecast.find(f => f.date === dateStr)
      
      calendarDays.push({
        date: new Date(current),
        dateStr,
        forecast: forecastDay
      })
      
      current.setDate(current.getDate() + 1)
    }

    // Group by weeks
    const weeks = []
    let currentWeek: any[] = []
    
    calendarDays.forEach(day => {
      if (day.date.getDay() === 1 && currentWeek.length > 0) {
        weeks.push([...currentWeek])
        currentWeek = []
      }
      currentWeek.push(day)
    })
    
    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    return (
      <div className="space-y-4">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-2">
            {week.map((day, dayIndex) => {
              const isToday = day.dateStr === today.toISOString().split('T')[0]
              const isPast = day.date < today
              const forecast = day.forecast
              
              return (
                <div
                  key={dayIndex}
                  className={`
                    border rounded-lg p-3 min-h-[120px] cursor-pointer transition-all hover:shadow-md
                    ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
                    ${isPast ? 'opacity-60' : ''}
                    ${selectedDate === day.dateStr ? 'ring-2 ring-blue-500' : ''}
                  `}
                  onClick={() => handleDayClick(day.dateStr)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-900">
                      {day.date.getDate()}
                    </div>
                    <div className="flex items-center space-x-1">
                      {forecast && getTrendIcon(forecast.trend)}
                      <span title={getWeatherTooltip(forecast?.weather)}>
                        {forecast && getWeatherIcon(forecast.weather)}
                      </span>
                      {forecast?.accuracy && (
                        <span className="text-xs" title={`Genauigkeit: ${forecast.accuracy.percentage}%`}>
                          {getAccuracyIcon(forecast.accuracy.rating)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {forecast && (
                    <div className="space-y-1">
                      <div className="text-xs text-gray-600">
                        {day.date.toLocaleDateString('de-DE', { weekday: 'short' })}
                      </div>
                      
                      <div className="text-sm font-semibold text-gray-900">
                        €{forecast.forecastedRevenue.toFixed(0)}
                      </div>
                      
                      {forecast.actualRevenue && (
                        <div className="text-xs text-gray-500">
                          Tatsächlich: €{forecast.actualRevenue.toFixed(0)}
                        </div>
                      )}
                      
                      {forecast.weather && (
                        <div className="text-xs text-gray-500">
                          {forecast.weather.temperature}°C, {forecast.weather.precipitation}mm
                        </div>
                      )}
                      
                      {forecast.accuracy && (
                        <div className={`text-xs px-1 py-0.5 rounded ${getAccuracyColor(forecast.accuracy.rating)}`}>
                          {forecast.accuracy.percentage}% genau
                        </div>
                      )}
                      
                      <div className={`text-xs ${getConfidenceColor(forecast.confidence)}`}>
                        {forecast.confidence}% sicher
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderChartView = () => {
    if (!forecastData?.forecast) return null

    const maxRevenue = Math.max(...forecastData.forecast.map(f => f.forecastedRevenue))
    
    return (
      <div className="space-y-4">
        {forecastData.forecast.map((day, index) => {
          const barHeight = (day.forecastedRevenue / maxRevenue) * 100
          const isToday = day.date === new Date().toISOString().split('T')[0]
          
          return (
            <div 
              key={index} 
              className={`flex items-end space-x-2 p-3 bg-white rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                selectedDate === day.date ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleDayClick(day.date)}
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(day.date).toLocaleDateString('de-DE', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(day.trend)}
                    <span title={getWeatherTooltip(day.weather)}>
                      {getWeatherIcon(day.weather)}
                    </span>
                    {day.accuracy && (
                      <span className="text-xs" title={`Genauigkeit: ${day.accuracy.percentage}%`}>
                        {getAccuracyIcon(day.accuracy.rating)}
                      </span>
                    )}
                    <span className={`text-xs ${getConfidenceColor(day.confidence)}`}>
                      {day.confidence}%
                    </span>
                  </div>
                </div>
                
                <div className="flex items-end space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isToday ? 'bg-blue-500' : 'bg-gray-600'
                      }`}
                      style={{ width: `${barHeight}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                      €{day.forecastedRevenue.toFixed(0)}
                    </div>
                  </div>
                </div>
                
                {day.actualRevenue && (
                  <div className="text-xs text-gray-500 mt-1">
                    Tatsächlich: €{day.actualRevenue.toFixed(0)}
                  </div>
                )}
                
                {day.weather && (
                  <div className="text-xs text-gray-500 mt-1">
                    Wetter: {day.weather.temperature}°C, {day.weather.precipitation}mm Regen
                  </div>
                )}
                
                {day.accuracy && (
                  <div className={`text-xs px-2 py-1 rounded mt-1 inline-block ${getAccuracyColor(day.accuracy.rating)}`}>
                    {day.accuracy.percentage}% genau (Abweichung: €{day.accuracy.difference})
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const getWeatherCodeIcon = (code: number) => {
    if (code <= 1) return <Sun className="h-4 w-4 text-yellow-500" />
    if (code <= 3) return <Cloud className="h-4 w-4 text-gray-500" />
    return <CloudRain className="h-4 w-4 text-blue-500" />
  }

  const getWeatherCodeText = (code: number) => {
    if (code === 0) return 'Klar'
    if (code === 1) return 'Meist klar'
    if (code === 2) return 'Teilweise bewölkt'
    if (code === 3) return 'Bewölkt'
    if (code >= 45 && code <= 48) return 'Nebel'
    if (code >= 51 && code <= 57) return 'Nieselregen'
    if (code >= 61 && code <= 67) return 'Regen'
    if (code >= 71 && code <= 77) return 'Schnee'
    if (code >= 80 && code <= 82) return 'Regenschauer'
    if (code >= 85 && code <= 86) return 'Schneeschauer'
    if (code >= 95) return 'Gewitter'
    return 'Unbekannt'
  }

  const renderHourlyDetail = () => {
    if (!selectedDate) return null

    const selectedForecast = forecastData?.forecast.find(f => f.date === selectedDate)
    const formattedDate = new Date(selectedDate).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{formattedDate}</h2>
                {selectedForecast && (
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="text-lg font-semibold text-green-600">
                      Prognose: €{selectedForecast.forecastedRevenue.toFixed(0)}
                    </div>
                    {selectedForecast.actualRevenue && (
                      <div className="text-lg text-gray-600">
                        Tatsächlich: €{selectedForecast.actualRevenue.toFixed(0)}
                      </div>
                    )}
                    <div className={`text-sm px-2 py-1 rounded ${getConfidenceColor(selectedForecast.confidence)}`}>
                      {selectedForecast.confidence}% Sicherheit
                    </div>
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={() => setSelectedDate(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕ Schließen
              </Button>
            </div>

            {isLoadingHourly ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">Lade stündliche Daten...</span>
              </div>
            ) : hourlyData.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Stündliche Wettervorhersage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {hourlyData.map((hour, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-lg font-semibold text-gray-900">
                          {hour.hour.toString().padStart(2, '0')}:00
                        </div>
                        <div className="flex items-center space-x-1">
                          {getWeatherCodeIcon(hour.weather_code)}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Temperatur:</span>
                          <span className="font-medium">{hour.temperature}°C</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Niederschlag:</span>
                          <span className="font-medium">{hour.precipitation}mm</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Wind:</span>
                          <span className="font-medium">{hour.wind_speed}km/h</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Luftfeuchtigkeit:</span>
                          <span className="font-medium">{hour.humidity}%</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Druck:</span>
                          <span className="font-medium">{hour.pressure}hPa</span>
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-2">
                          {getWeatherCodeText(hour.weather_code)}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                
                {/* Temperature Chart */}
                <div className="mt-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Temperaturverlauf</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-end space-x-1 h-32">
                      {hourlyData.map((hour, index) => {
                        const maxTemp = Math.max(...hourlyData.map(h => h.temperature))
                        const minTemp = Math.min(...hourlyData.map(h => h.temperature))
                        const tempRange = maxTemp - minTemp || 1
                        const height = ((hour.temperature - minTemp) / tempRange) * 100
                        
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center">
                            <div className="text-xs text-gray-600 mb-1">
                              {hour.temperature}°
                            </div>
                            <div 
                              className="w-full bg-blue-500 rounded-t"
                              style={{ height: `${Math.max(height, 10)}%` }}
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              {hour.hour.toString().padStart(2, '0')}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Cloud className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Keine stündlichen Daten für diesen Tag verfügbar.</p>
                <Button 
                  onClick={() => fetchHourlyData(selectedDate)}
                  className="mt-4"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Erneut versuchen
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Lade Prognose-Daten...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Fehler</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchForecastData}>
            Erneut versuchen
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            {/* Mobile Layout */}
            <div className="block sm:hidden">
              <div className="flex items-center justify-between">
                <Link 
                  href="/dashboard" 
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Zurück zum Dashboard</span>
                </Link>
                
                <button 
                  onClick={fetchForecastData}
                  className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <Link 
                href="/dashboard" 
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Zurück zum Dashboard</span>
              </Link>
              
              <button 
                onClick={fetchForecastData}
                className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Umsatz-Prognose</h1>
          <p className="text-sm text-gray-600">Intelligente Vorhersagen basierend auf historischen Daten</p>
        </div>

        {/* Forecast Summary */}
        {forecastData && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Rollierende Basis (4 Wochen)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{forecastData.metadata.rollingBaseline.toFixed(0)}</div>
                <p className="text-xs text-gray-500">Durchschnittlicher Tagesumsatz</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Wochentrend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getTrendColor(forecastData.metadata.trends.weekly > 0 ? 'up' : 'down')}`}>
                  {forecastData.metadata.trends.weekly > 0 ? '+' : ''}{forecastData.metadata.trends.weekly.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500">Letzte 4 Wochen vs. davor</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Datenbasis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{forecastData.metadata.dataPoints}</div>
                <p className="text-xs text-gray-500">Historische Datenpunkte</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center">
                  <span className="mr-2">{getAccuracyIcon(forecastData.metadata.accuracy.rating)}</span>
                  Treffer-Genauigkeit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getAccuracyColor(forecastData.metadata.accuracy.rating).split(' ')[0]}`}>
                  {forecastData.metadata.accuracy.overall.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500">
                  {forecastData.metadata.accuracy.dataPoints} von {forecastData.metadata.accuracy.totalForecasts} Prognosen
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Date Range Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prognose-Zeitraum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 sm:space-y-0 sm:flex sm:items-end sm:gap-4">
              <div className="flex-1">
                <Label htmlFor="startDate" className="text-sm">Von</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="endDate" className="text-sm">Bis</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
              <Button onClick={fetchForecastData} className="w-full sm:w-auto sm:mt-0">
                <TrendingUp className="h-4 w-4 mr-2" />
                Prognose aktualisieren
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* View Toggle */}
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setSelectedView('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedView === 'calendar'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="h-4 w-4 mr-2 inline" />
            Kalender
          </button>
          <button
            onClick={() => setSelectedView('chart')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedView === 'chart'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="h-4 w-4 mr-2 inline" />
            Diagramm
          </button>
        </div>

        {/* Forecast Display */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedView === 'calendar' ? 'Kalender-Ansicht' : 'Diagramm-Ansicht'}
            </CardTitle>
            <CardDescription>
              {selectedView === 'calendar' 
                ? 'Tägliche Prognosen im Kalender-Format'
                : 'Umsatz-Prognosen als Balkendiagramm'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedView === 'calendar' ? renderCalendarView() : renderChartView()}
          </CardContent>
        </Card>

        {/* Weather Integration Note */}
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-sm text-green-900 flex items-center">
              <Cloud className="h-4 w-4 mr-2" />
              Wetter-Integration aktiv
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-800">
              Das System nutzt jetzt echte Wetterdaten von der Open-Meteo API. 
              Die Prognosen werden automatisch um Wetterfaktoren wie Temperatur, 
              Niederschlag und Windgeschwindigkeit erweitert.
            </p>
            <p className="text-xs text-green-700 mt-2">
              Datenquelle: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">Open-Meteo.com</a>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Detail Modal */}
      {renderHourlyDetail()}
    </div>
  )
}
