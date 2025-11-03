'use client'

import { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  RefreshCw, 
  Cloud,
  Sun,
  CloudRain,
  // CloudSnow,
  Wind,
  Thermometer,
  Droplets,
  Clock,
  MapPin
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface WeatherData {
  date: string
  hour: number
  temperature: number
  precipitation: number
  weather_code: number
  wind_speed: number
  humidity: number
  pressure: number
}

export default function WeatherPage() {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => {
    fetchWeatherData()
  }, [])

  const fetchWeatherData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/weather/sync')
      if (!response.ok) {
        throw new Error('Failed to fetch weather data')
      }
      
      const data = await response.json()
      console.log('Weather data response:', data)
      setWeatherData(data.data || [])
      setLastSync(new Date().toISOString())
    } catch (err) {
      console.error('Error fetching weather data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const syncWeatherData = async () => {
    try {
      setIsSyncing(true)
      setError(null)
      
      const response = await fetch('/api/weather/sync', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Failed to sync weather data')
      }
      
      const data = await response.json()
      console.log('Weather sync response:', data)
      
      // After sync, fetch the updated data
      await fetchWeatherData()
    } catch (err) {
      console.error('Error syncing weather data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSyncing(false)
    }
  }

  const getWeatherIcon = (weatherCode: number) => {
    if (weatherCode >= 80) return <CloudRain className="h-5 w-5 text-blue-500" />
    if (weatherCode >= 60) return <CloudRain className="h-5 w-5 text-blue-400" />
    if (weatherCode >= 40) return <Cloud className="h-5 w-5 text-gray-500" />
    if (weatherCode >= 20) return <Cloud className="h-5 w-5 text-gray-400" />
    if (weatherCode >= 10) return <Cloud className="h-5 w-5 text-gray-300" />
    return <Sun className="h-5 w-5 text-yellow-500" />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Lade Wetterdaten...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Cloud className="h-8 w-8 mx-auto mb-4 text-red-500" />
              <p className="text-red-600 mb-4">Fehler beim Laden der Wetterdaten</p>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchWeatherData} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Erneut versuchen
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wetter-Synchronisation</h1>
              <p className="text-gray-600">Aktuelle Wetterdaten für Hamburg</p>
            </div>
            
            <Button 
              onClick={syncWeatherData} 
              disabled={isSyncing}
              className="flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Cloud className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-sm">Aktiv</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Letzte Synchronisation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-sm">
                  {lastSync ? new Date(lastSync).toLocaleString('de-DE') : 'Nie'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Standort</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <MapPin className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-sm">Hamburg, Deutschland</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weather Data */}
        <Card>
          <CardHeader>
            <CardTitle>Aktuelle Wetterdaten</CardTitle>
            <CardDescription>
              Stündliche Wetterdaten für Hamburg (Seilerstraße 40)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">Fehler: {error}</p>
              </div>
            )}
            
            {weatherData.length === 0 ? (
              <div className="text-center py-8">
                <Cloud className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Keine Wetterdaten verfügbar</p>
                <p className="text-sm text-gray-500 mt-2">
                  Klicken Sie auf "Jetzt synchronisieren", um Wetterdaten zu laden.
                </p>
                {isLoading && (
                  <p className="text-sm text-blue-600 mt-2">Lade Daten...</p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-gray-600">
                  {weatherData.length} Wetterdatenpunkte verfügbar
                </p>
                
                {/* Today's Weather */}
                {(() => {
                  const today = new Date().toISOString().split('T')[0]
                  const todayData = weatherData.filter(item => item.date === today)
                  
                  if (todayData.length > 0) {
                    return (
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                          <Sun className="h-5 w-5 text-yellow-500 mr-2" />
                          Heute ({new Date().toLocaleDateString('de-DE')})
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {todayData.filter((_, index) => index % 3 === 0).slice(0, 8).map((item, index) => (
                            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                              <div className="text-xs text-gray-600 mb-1">{item.hour}:00</div>
                              <div className="flex justify-center mb-2">
                                {getWeatherIcon(item.weather_code)}
                              </div>
                              <div className="text-sm font-semibold">{item.temperature.toFixed(1)}°C</div>
                              <div className="text-xs text-gray-500">{item.precipitation.toFixed(1)}mm</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Weekly Overview */}
                {(() => {
                  const dailyData = weatherData.reduce((acc, item) => {
                    if (!acc[item.date]) {
                      acc[item.date] = []
                    }
                    acc[item.date].push(item)
                    return acc
                  }, {} as Record<string, WeatherData[]>)

                  const sortedDates = Object.keys(dailyData).sort()
                  const next14Days = sortedDates.slice(0, 14)

                  return (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <Cloud className="h-5 w-5 text-gray-500 mr-2" />
                        14-Tage Übersicht
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {next14Days.map((date) => {
                          const dayData = dailyData[date]
                          const maxTemp = Math.max(...dayData.map(item => item.temperature))
                          const minTemp = Math.min(...dayData.map(item => item.temperature))
                          const totalPrecipitation = dayData.reduce((sum, item) => sum + item.precipitation, 0)
                          const avgWeatherCode = Math.round(dayData.reduce((sum, item) => sum + item.weather_code, 0) / dayData.length)
                          
                          const dateObj = new Date(date)
                          const isToday = date === new Date().toISOString().split('T')[0]
                          const isTomorrow = date === new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                          
                          let dayLabel = dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
                          if (isToday) dayLabel = 'Heute'
                          else if (isTomorrow) dayLabel = 'Morgen'

                          return (
                            <div key={date} className={`border rounded-lg p-4 ${isToday ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <div className="font-medium text-gray-900">{dayLabel}</div>
                                  <div className="text-xs text-gray-500">{dateObj.toLocaleDateString('de-DE')}</div>
                                </div>
                                <div className="flex items-center">
                                  {getWeatherIcon(avgWeatherCode)}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="flex items-center text-red-600">
                                    <Thermometer className="h-3 w-3 mr-1" />
                                    <span className="font-medium">{maxTemp.toFixed(1)}°</span>
                                  </div>
                                  <div className="flex items-center text-blue-600 mt-1">
                                    <Thermometer className="h-3 w-3 mr-1" />
                                    <span>{minTemp.toFixed(1)}°</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center text-blue-500">
                                    <Droplets className="h-3 w-3 mr-1" />
                                    <span>{totalPrecipitation.toFixed(1)}mm</span>
                                  </div>
                                  <div className="flex items-center text-gray-500 mt-1">
                                    <Wind className="h-3 w-3 mr-1" />
                                    <span>{(dayData.reduce((sum, item) => sum + item.wind_speed, 0) / dayData.length).toFixed(1)} km/h</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Informationen</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            <p className="mb-2">
              <strong>Datenquelle:</strong> Open-Meteo API (https://open-meteo.com/)
            </p>
            <p className="mb-2">
              <strong>Standort:</strong> Seilerstraße 40, 20359 Hamburg, Deutschland
            </p>
            <p className="mb-2">
              <strong>Koordinaten:</strong> 53.5511°N, 9.9937°E
            </p>
            <p>
              <strong>Update-Frequenz:</strong> Stündlich (automatisch via Cron Job)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}