'use client'

import { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  RefreshCw, 
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Thermometer,
  Droplets,
  MapPin,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CurrentWeather {
  temperature: number
  humidity: number
  weatherCode: number
  windSpeed: number
  precipitation: number
  time: string
}


interface HourlyData {
  time: string
  hour: number
  temperature: number
  precipitation: number
  weatherCode: number
}

interface ForecastDay {
  date: string
  temperatureMax: number
  temperatureMin: number
  weatherCode: number
  precipitation: number
  windSpeed: number
  sunrise?: string | null
  sunset?: string | null
}

export default function WeatherPage() {
  const [current, setCurrent] = useState<CurrentWeather | null>(null)
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
  const [sunrise, setSunrise] = useState<string | null>(null)
  const [sunset, setSunset] = useState<string | null>(null)
  const [isLoadingHourly, setIsLoadingHourly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWeatherData()
  }, [])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedDate) {
        setSelectedDate(null)
        setHourlyData([])
        setSunrise(null)
        setSunset(null)
        setError(null)
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [selectedDate])

  const fetchWeatherData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Get session token for authorization
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch('/api/weather/current', {
        headers
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch weather data')
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setCurrent(data.current)
      setForecast(data.forecast || [])
    } catch (err) {
      console.error('Error fetching weather data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const getWeatherIcon = (weatherCode: number, size: 'small' | 'large' = 'small') => {
    const iconSize = size === 'large' ? 'h-16 w-16' : 'h-6 w-6'
    
    // WMO Weather interpretation codes (WW)
    if (weatherCode >= 95) return <CloudRain className={`${iconSize} text-purple-600`} /> // Thunderstorm
    if (weatherCode >= 85) return <CloudSnow className={`${iconSize} text-blue-300`} /> // Heavy snow
    if (weatherCode >= 71) return <CloudSnow className={`${iconSize} text-gray-300`} /> // Snow
    if (weatherCode >= 61) return <CloudRain className={`${iconSize} text-blue-600`} /> // Rain
    if (weatherCode >= 51) return <CloudRain className={`${iconSize} text-blue-400`} /> // Drizzle
    if (weatherCode >= 45) return <Cloud className={`${iconSize} text-gray-500`} /> // Fog
    if (weatherCode >= 3) return <Cloud className={`${iconSize} text-gray-400`} /> // Overcast
    if (weatherCode >= 1) return <Cloud className={`${iconSize} text-gray-300`} /> // Partly cloudy
    return <Sun className={`${iconSize} text-yellow-500`} /> // Clear sky
  }

  const getWeatherDescription = (weatherCode: number): string => {
    if (weatherCode >= 95) return 'Gewitter'
    if (weatherCode >= 85) return 'Starker Schneefall'
    if (weatherCode >= 71) return 'Schnee'
    if (weatherCode >= 61) return 'Regen'
    if (weatherCode >= 51) return 'Nieselregen'
    if (weatherCode >= 45) return 'Nebel'
    if (weatherCode >= 3) return 'Bedeckt'
    if (weatherCode >= 1) return 'Teilweise bewölkt'
    return 'Klar'
  }

  const fetchHourlyData = async (date: string) => {
    try {
      setIsLoadingHourly(true)
      setError(null)
      
      // Get session token for authorization
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(`/api/weather/current?date=${date}`, {
        headers
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to fetch hourly weather data')
      }
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      if (!data.hourly || data.hourly.length === 0) {
        throw new Error('Keine stündlichen Daten für diesen Tag verfügbar')
      }
      
      setHourlyData(data.hourly || [])
      setSunrise(data.sunrise || null)
      setSunset(data.sunset || null)
    } catch (err) {
      console.error('Error fetching hourly weather data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      // Don't show error in main error state, just log it
      // The hourly view will show its own error message
    } finally {
      setIsLoadingHourly(false)
    }
  }

  const handleDayClick = (date: string) => {
    // Always open the hourly view (modal) for the selected date
    setSelectedDate(date)
    setError(null)
    fetchHourlyData(date)
  }

  const closeHourlyModal = () => {
    setSelectedDate(null)
    setHourlyData([])
    setSunrise(null)
    setSunset(null)
    setError(null)
  }

  const getSunriseSunsetForHour = (hour: number): { type: 'sunrise' | 'sunset' | null, time: string | null } => {
    if (!sunrise || !sunset) return { type: null, time: null }
    
    const sunriseDate = new Date(sunrise)
    const sunsetDate = new Date(sunset)
    const sunriseHour = sunriseDate.getHours()
    const sunriseMinute = sunriseDate.getMinutes()
    const sunsetHour = sunsetDate.getHours()
    const sunsetMinute = sunsetDate.getMinutes()
    
    // Check if this hour contains sunrise
    if (hour === sunriseHour) {
      return { 
        type: 'sunrise', 
        time: `${sunriseHour.toString().padStart(2, '0')}:${sunriseMinute.toString().padStart(2, '0')}` 
      }
    }
    
    // Check if this hour contains sunset
    if (hour === sunsetHour) {
      return { 
        type: 'sunset', 
        time: `${sunsetHour.toString().padStart(2, '0')}:${sunsetMinute.toString().padStart(2, '0')}` 
      }
    }
    
    return { type: null, time: null }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Heute'
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Morgen'
    }
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Lade Wetterdaten...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <Cloud className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 font-medium mb-2">Fehler beim Laden der Wetterdaten</p>
            <p className="text-gray-600 text-sm mb-4">{error}</p>
            <button
              onClick={fetchWeatherData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Erneut versuchen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Wetter</h1>
                <p className="text-sm text-gray-600 mt-1">Aktuelles Wetter und 14-Tage-Vorhersage</p>
              </div>
            </div>
            
            <button
              onClick={fetchWeatherData}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Aktualisieren</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Current Weather */}
          {current && (
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <MapPin className="h-5 w-5" />
                    <span className="text-lg font-medium">Hamburg, Deutschland</span>
                  </div>
                  <p className="text-blue-100 text-sm">
                    {new Date(current.time).toLocaleString('de-DE', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  {getWeatherIcon(current.weatherCode, 'large')}
                  <p className="text-blue-100 text-sm mt-2">{getWeatherDescription(current.weatherCode)}</p>
                </div>
              </div>

              <div className="flex items-end space-x-8">
                <div>
                  <div className="text-6xl font-bold">{current.temperature.toFixed(1)}°</div>
                  <div className="text-blue-100 text-sm mt-1">Aktuelle Temperatur</div>
                </div>
                
                <div className="grid grid-cols-3 gap-6 flex-1 max-w-md">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Droplets className="h-4 w-4" />
                      <span className="text-2xl font-semibold">{current.humidity}%</span>
                    </div>
                    <div className="text-blue-100 text-xs">Luftfeuchtigkeit</div>
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Wind className="h-4 w-4" />
                      <span className="text-2xl font-semibold">{current.windSpeed}</span>
                    </div>
                    <div className="text-blue-100 text-xs">Wind (km/h)</div>
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <CloudRain className="h-4 w-4" />
                      <span className="text-2xl font-semibold">{current.precipitation}</span>
                    </div>
                    <div className="text-blue-100 text-xs">Niederschlag (mm)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 14-Day Forecast */}
          {forecast.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">14-Tage-Vorhersage</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
                {forecast.map((day, index) => {
                  const isToday = index === 0
                  const isSelected = selectedDate === day.date
                  return (
                    <button
                      key={day.date}
                      onClick={() => handleDayClick(day.date)}
                      className={`border rounded-lg p-4 transition-all text-left ${
                        isSelected
                          ? 'bg-blue-100 border-blue-400 shadow-lg ring-2 ring-blue-300'
                          : isToday
                          ? 'bg-blue-50 border-blue-300 shadow-md hover:bg-blue-100'
                          : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-md'
                      }`}
                    >
                      <div className="text-center">
                        <div className={`font-medium mb-2 ${isSelected || isToday ? 'text-blue-900' : 'text-gray-900'}`}>
                          {formatDate(day.date)}
                        </div>
                        
                        <div className="flex justify-center mb-3">
                          {getWeatherIcon(day.weatherCode)}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-center space-x-2">
                            <Thermometer className="h-3 w-3 text-red-500" />
                            <span className="text-sm font-semibold text-gray-900">
                              {day.temperatureMax.toFixed(0)}°
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-center space-x-2">
                            <Thermometer className="h-3 w-3 text-blue-500" />
                            <span className="text-sm text-gray-600">
                              {day.temperatureMin.toFixed(0)}°
                            </span>
                          </div>
                          
                          {day.precipitation > 0 && (
                            <div className="flex items-center justify-center space-x-1 mt-2">
                              <Droplets className="h-3 w-3 text-blue-500" />
                              <span className="text-xs text-gray-600">
                                {day.precipitation.toFixed(1)}mm
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-center space-x-1 mt-1">
                            <Wind className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {day.windSpeed.toFixed(0)} km/h
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Hourly View Modal */}
          {selectedDate && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeHourlyModal()
                }
              }}
            >
              <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Stündliche Vorhersage - {formatFullDate(selectedDate)}
                  </h2>
                  <button
                    onClick={closeHourlyModal}
                    className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Schließen"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {isLoadingHourly ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <span className="ml-3 text-gray-600">Lade stündliche Daten...</span>
                    </div>
                  ) : error && selectedDate ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                      <p className="text-red-600 font-medium mb-2">Fehler beim Laden der stündlichen Daten</p>
                      <p className="text-red-500 text-sm mb-4">{error}</p>
                      <button
                        onClick={() => fetchHourlyData(selectedDate)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        Erneut versuchen
                      </button>
                    </div>
                  ) : hourlyData.length > 0 ? (
                    <div>
                      {/* Sunrise/Sunset Info */}
                      {(sunrise || sunset) && (
                        <div className="mb-4 flex items-center justify-center space-x-6 text-sm text-gray-600">
                          {sunrise && (
                            <div className="flex items-center space-x-2">
                              <Sun className="h-4 w-4 text-yellow-500" />
                              <span>Sonnenaufgang: {new Date(sunrise).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                          {sunset && (
                            <div className="flex items-center space-x-2">
                              <Sun className="h-4 w-4 text-orange-500 rotate-180" />
                              <span>Sonnenuntergang: {new Date(sunset).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {hourlyData.map((hour) => {
                          const sunInfo = getSunriseSunsetForHour(hour.hour)
                          return (
                            <div
                              key={hour.time}
                              className={`border rounded-lg p-3 transition-colors ${
                                sunInfo.type === 'sunrise'
                                  ? 'bg-yellow-50 border-yellow-300 shadow-md'
                                  : sunInfo.type === 'sunset'
                                  ? 'bg-orange-50 border-orange-300 shadow-md'
                                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <div className="text-center">
                                <div className="text-sm font-medium text-gray-900 mb-1">
                                  {hour.hour.toString().padStart(2, '0')}:00
                                </div>
                                
                                {sunInfo.type && sunInfo.time && (
                                  <div className={`text-xs font-medium mb-1 ${
                                    sunInfo.type === 'sunrise' ? 'text-yellow-700' : 'text-orange-700'
                                  }`}>
                                    {sunInfo.type === 'sunrise' ? '☀️ Aufgang' : '🌅 Untergang'} {sunInfo.time}
                                  </div>
                                )}
                                
                                <div className="flex justify-center mb-2">
                                  {getWeatherIcon(hour.weatherCode)}
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center justify-center">
                                    <Thermometer className="h-3 w-3 text-red-500 mr-1" />
                                    <span className="text-sm font-semibold text-gray-900">
                                      {hour.temperature.toFixed(0)}°
                                    </span>
                                  </div>
                                  
                                  {hour.precipitation > 0 && (
                                    <div className="flex items-center justify-center">
                                      <Droplets className="h-3 w-3 text-blue-500 mr-1" />
                                      <span className="text-xs text-gray-600">
                                        {hour.precipitation.toFixed(1)}mm
                                      </span>
                                    </div>
                                  )}
                                  
                                  {hour.precipitation === 0 && (
                                    <div className="text-xs text-gray-400">-</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      Keine stündlichen Daten verfügbar
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p className="mb-1">
              <strong>Datenquelle:</strong> Open-Meteo API (https://open-meteo.com/)
            </p>
            <p>
              <strong>Standort:</strong> Seilerstraße 40, 20359 Hamburg, Deutschland (53.5511°N, 9.9937°E)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
