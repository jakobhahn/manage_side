'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  RefreshCw, 
  Cloud,
  Sun,
  CloudRain,
  Thermometer,
  Droplets,
  Wind,
  Eye,
  Clock,
  MapPin
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface WeatherData {
  date: string
  hour: number
  temperature: number
  precipitation: number
  weather_code: number
  wind_speed: number
  humidity: number
  pressure: number
  updated_at: string
}

export default function WeatherPage() {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    fetchWeatherData()
  }, [])

  const fetchWeatherData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/weather/sync')
      if (response.ok) {
        const data = await response.json()
        setWeatherData(data.data || [])
        setLastSync(data.data?.[0]?.updated_at || null)
      } else {
        throw new Error('Failed to fetch weather data')
      }
    } catch (error: any) {
      console.error('Error fetching weather data:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const syncWeatherData = async () => {
    try {
      setIsSyncing(true)
      setError(null)

      const response = await fetch('/api/weather/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to sync weather data')
      }

      const result = await response.json()
      console.log('Weather sync result:', result)
      
      // Aktualisiere die Daten nach dem Sync
      await fetchWeatherData()
    } catch (error: any) {
      console.error('Error syncing weather data:', error)
      setError(error.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const getWeatherIcon = (weatherCode: number) => {
    if (weatherCode >= 80) {
      return <CloudRain className="h-5 w-5 text-blue-600" />
    } else if (weatherCode >= 60) {
      return <CloudRain className="h-5 w-5 text-blue-500" />
    } else if (weatherCode >= 40) {
      return <Cloud className="h-5 w-5 text-gray-400" />
    } else if (weatherCode >= 20) {
      return <Cloud className="h-5 w-5 text-gray-500" />
    } else if (weatherCode >= 10) {
      return <Cloud className="h-5 w-5 text-gray-300" />
    } else {
      return <Sun className="h-5 w-5 text-yellow-500" />
    }
  }

  const getWeatherDescription = (weatherCode: number) => {
    if (weatherCode >= 80) return 'Regen/Gewitter'
    if (weatherCode >= 60) return 'Leichter Regen'
    if (weatherCode >= 40) return 'Nebel'
    if (weatherCode >= 20) return 'Bewölkt'
    if (weatherCode >= 10) return 'Teilweise bewölkt'
    return 'Klar/Sonnig'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  // Gruppiere Daten nach Tagen
  const groupedData = weatherData.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = []
    }
    acc[item.date].push(item)
    return acc
  }, {} as Record<string, WeatherData[]>)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Lade Wetterdaten...</p>
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
          <Button onClick={fetchWeatherData}>
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
                  onClick={syncWeatherData}
                  disabled={isSyncing}
                  className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
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
                onClick={syncWeatherData}
                disabled={isSyncing}
                className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wetter-Management</h1>
          <p className="text-sm text-gray-600">Stündliche Wetterdaten für Hamburg, Seilerstraße 40</p>
        </div>

        {/* Location Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Standort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div>
                <p className="font-medium">Seilerstraße 40</p>
                <p className="text-sm text-gray-600">20359 Hamburg, Deutschland</p>
                <p className="text-xs text-gray-500">Koordinaten: 53.5511°N, 9.9937°E</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Datenquelle:</p>
                <a 
                  href="https://open-meteo.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open-Meteo API
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Synchronisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Letzte Synchronisation: {lastSync ? new Date(lastSync).toLocaleString('de-DE') : 'Nie'}
                </p>
                <p className="text-xs text-gray-500">
                  Gespeicherte Datenpunkte: {weatherData.length}
                </p>
              </div>
              <Button 
                onClick={syncWeatherData}
                disabled={isSyncing}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Weather Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Wetterdaten</CardTitle>
            <CardDescription>
              Stündliche Wetterdaten der letzten Tage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(groupedData).length === 0 ? (
              <div className="text-center py-8">
                <Cloud className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Keine Wetterdaten verfügbar</p>
                <p className="text-sm text-gray-500">Klicken Sie auf "Jetzt synchronisieren" um Daten zu laden</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedData)
                  .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                  .slice(0, 7) // Zeige nur die letzten 7 Tage
                  .map(([date, dayData]) => (
                    <div key={date} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">
                        {formatDate(date)}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                        {dayData
                          .sort((a, b) => a.hour - b.hour)
                          .map((hourData) => (
                            <div 
                              key={`${date}-${hourData.hour}`}
                              className="bg-gray-50 rounded-lg p-3 text-center"
                            >
                              <div className="text-xs text-gray-600 mb-1">
                                {formatTime(hourData.hour)}
                              </div>
                              <div className="flex justify-center mb-1">
                                {getWeatherIcon(hourData.weather_code)}
                              </div>
                              <div className="text-sm font-medium text-gray-900">
                                {hourData.temperature}°C
                              </div>
                              <div className="text-xs text-gray-500">
                                {hourData.precipitation}mm
                              </div>
                              <div className="text-xs text-gray-500">
                                {hourData.wind_speed}km/h
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weather Summary */}
        {weatherData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wetter-Übersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex items-center space-x-3">
                  <Thermometer className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-sm text-gray-600">Durchschnittstemperatur</p>
                    <p className="text-lg font-semibold">
                      {Math.round(weatherData.reduce((sum, d) => sum + d.temperature, 0) / weatherData.length * 10) / 10}°C
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Droplets className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Gesamtniederschlag</p>
                    <p className="text-lg font-semibold">
                      {Math.round(weatherData.reduce((sum, d) => sum + d.precipitation, 0) * 10) / 10}mm
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Wind className="h-8 w-8 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Durchschnittswind</p>
                    <p className="text-lg font-semibold">
                      {Math.round(weatherData.reduce((sum, d) => sum + d.wind_speed, 0) / weatherData.length * 10) / 10}km/h
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Eye className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Durchschnittsfeuchte</p>
                    <p className="text-lg font-semibold">
                      {Math.round(weatherData.reduce((sum, d) => sum + d.humidity, 0) / weatherData.length)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
