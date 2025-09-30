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
  Eye,
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
      setWeatherData(data.weatherData || [])
      setLastSync(data.lastSync || new Date().toISOString())
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
      setWeatherData(data.weatherData || [])
      setLastSync(data.lastSync || new Date().toISOString())
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
            {weatherData.length === 0 ? (
              <div className="text-center py-8">
                <Cloud className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Keine Wetterdaten verfügbar</p>
                <p className="text-sm text-gray-500 mt-2">
                  Klicken Sie auf "Jetzt synchronisieren", um Wetterdaten zu laden.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {weatherData.slice(0, 6).map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          {getWeatherIcon(item.weather_code)}
                          <span className="ml-2 text-sm font-medium">
                            {new Date(item.date).toLocaleDateString('de-DE')} {item.hour}:00
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Thermometer className="h-4 w-4 text-red-500 mr-2" />
                          <span>{item.temperature.toFixed(1)}°C</span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Droplets className="h-4 w-4 text-blue-500 mr-2" />
                          <span>{item.precipitation.toFixed(1)}mm</span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Wind className="h-4 w-4 text-gray-500 mr-2" />
                          <span>{item.wind_speed.toFixed(1)} km/h</span>
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <Eye className="h-4 w-4 text-gray-500 mr-2" />
                          <span>{item.humidity.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {weatherData.length > 6 && (
                  <div className="text-center text-sm text-gray-500">
                    ... und {weatherData.length - 6} weitere Einträge
                  </div>
                )}
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