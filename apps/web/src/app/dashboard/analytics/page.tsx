'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  TrendingUp, 
  DollarSign,
  Activity,
  RefreshCw,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

interface WeekdayData {
  name: string
  day: number
  transactions: number
  revenue: number
  avgValue: number
}

interface WeeklyData {
  week: number
  year: number
  label: string
  transactions: number
  revenue: number
  avgValue: number
}

interface HourlyData {
  hour: number
  label: string
  transactions: number
  revenue: number
  avgValue: number
}

interface WeekdayDetailData {
  date: string
  weekday: number
  weekdayName: string
  revenue: number
  transactions: number
  avgTransactionValue: number
  formattedDate: string
}

interface WeekdayDetailSummary {
  totalDays: number
  totalRevenue: number
  totalTransactions: number
  avgRevenuePerDay: number
  avgTransactionsPerDay: number
  avgTransactionValue: number
}

interface TimeComparisonData {
  period: string
  hours: {
    hour: number
    transactions: number
    revenue: number
    avgValue: number
  }[]
}

interface MealTimeData {
  period: string
  name: string
  timeRange: string
  totalTransactions: number
  totalRevenue: number
  uniqueDays: number
  avgRevenuePerDay: number
  avgTransactionsPerDay: number
  avgTransactionValue: number
}

interface MealTimeComparison {
  revenueRatio: number
  transactionRatio: number
  strongerPeriod: 'lunch' | 'dinner' | null
}

interface AnalyticsData {
  weekdays: WeekdayData[]
  weeks: WeeklyData[]
  hours: HourlyData[]
  weekdayDetails?: WeekdayDetailData[]
  summary?: WeekdayDetailSummary
  periods?: TimeComparisonData[]
  mealTimes?: MealTimeData[]
  comparison?: MealTimeComparison
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeTab, setActiveTab] = useState<'weekdays' | 'weeks' | 'hours' | 'weekday-detail' | 'time-comparison' | 'meal-times'>('weekdays')
  const [selectedWeekday, setSelectedWeekday] = useState('5') // Default to Friday (5)
  const [timeComparisonPeriod, setTimeComparisonPeriod] = useState<'weekly' | 'monthly'>('weekly')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Set default date range (last 30 days)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
    
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      
      // Determine analysis type based on active tab
      let analysisType = 'overview'
      if (activeTab === 'weekday-detail') {
        analysisType = 'weekday-detail'
        params.append('weekday', selectedWeekday)
      } else if (activeTab === 'weekdays') {
        analysisType = 'weekdays'
      } else if (activeTab === 'weeks') {
        analysisType = 'weeks'
      } else if (activeTab === 'hours') {
        analysisType = 'hours'
      } else if (activeTab === 'time-comparison') {
        analysisType = 'time-comparison'
        params.append('period', timeComparisonPeriod)
      } else if (activeTab === 'meal-times') {
        analysisType = 'meal-times'
      }

      const response = await fetch(`/api/analytics?type=${analysisType}&${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setAnalyticsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const getMaxValue = (data: any[], key: string) => {
    return Math.max(...data.map(item => item[key] || 0))
  }

  const renderWeekdayChart = () => {
    if (!analyticsData?.weekdays) return null

    // Sort weekdays by revenue (best days first)
    const sortedWeekdays = [...analyticsData.weekdays].sort((a, b) => b.revenue - a.revenue)
    
    const maxRevenue = getMaxValue(analyticsData.weekdays, 'revenue')
    const maxTransactions = getMaxValue(analyticsData.weekdays, 'transactions')

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                Umsatz nach Wochentagen
              </CardTitle>
              <CardDescription className="text-sm">
                Durchschnittlicher Umsatz pro Wochentag (sortiert nach besten Tagen)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedWeekdays.map((day) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium w-16 sm:w-20">{day.name}</span>
                    <div className="flex-1 mx-2 sm:mx-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono w-16 sm:w-20 text-right">
                      {formatCurrency(day.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                Transaktionen nach Wochentagen
              </CardTitle>
              <CardDescription className="text-sm">
                Gesamtanzahl Transaktionen pro Wochentag (sortiert nach Umsatz)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedWeekdays.map((day) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium w-16 sm:w-20">{day.name}</span>
                    <div className="flex-1 mx-2 sm:mx-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxTransactions > 0 ? (day.transactions / maxTransactions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-mono w-16 sm:w-20 text-right">
                      {day.transactions}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Durchschnittlicher Transaktionswert</CardTitle>
            <CardDescription>
              Durchschnittlicher Wert pro Transaktion (sortiert nach Umsatz)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {sortedWeekdays.map((day) => (
                <div key={day.day} className="text-center">
                  <div className="text-xs text-gray-500 mb-1">
                    {day.name}
                  </div>
                  <div className="text-sm font-mono">
                    {formatCurrency(day.avgValue)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderWeeklyChart = () => {
    if (!analyticsData?.weeks) return null

    const maxRevenue = getMaxValue(analyticsData.weeks, 'revenue')
    const maxTransactions = getMaxValue(analyticsData.weeks, 'transactions')

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Wöchentliche Umsätze
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.weeks.map((week) => (
                <div key={`${week.year}-${week.week}`} className="flex items-center justify-between">
                  <span className="text-sm font-medium w-20">{week.label}</span>
                  <div className="flex-1 mx-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${maxRevenue > 0 ? (week.revenue / maxRevenue) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-mono w-20 text-right">
                    {formatCurrency(week.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wöchentliche Transaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.weeks.map((week) => (
                <div key={`${week.year}-${week.week}`} className="flex items-center justify-between">
                  <span className="text-sm font-medium w-20">{week.label}</span>
                  <div className="flex-1 mx-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${maxTransactions > 0 ? (week.transactions / maxTransactions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-mono w-20 text-right">
                    {week.transactions}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderHourlyChart = () => {
    if (!analyticsData?.hours) return null

    const maxRevenue = getMaxValue(analyticsData.hours, 'revenue')
    // const maxTransactions = getMaxValue(analyticsData.hours, 'transactions')

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Stündliche Umsätze
            </CardTitle>
            <CardDescription>
              Zeigt die Verkäufe nach Uhrzeiten - perfekt um Spitzenzeiten zu identifizieren
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {analyticsData.hours.map((hour) => (
                <div key={hour.hour} className="text-center">
                  <div className="text-xs text-gray-500 mb-1">{hour.label}</div>
                  <div className="w-full bg-gray-200 rounded-full h-8 mb-1">
                    <div 
                      className="bg-red-600 h-8 rounded-full transition-all duration-300 flex items-center justify-center"
                      style={{ width: `${maxRevenue > 0 ? (hour.revenue / maxRevenue) * 100 : 0}%` }}
                    >
                      {hour.revenue > 0 && (
                        <span className="text-xs text-white font-bold">
                          {formatCurrency(hour.revenue)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {hour.transactions} Trans.
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spitzenzeiten Analyse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {analyticsData.hours.reduce((max, hour) => 
                    hour.revenue > max.revenue ? hour : max
                  ).label}
                </div>
                <div className="text-sm text-gray-600">Höchster Umsatz</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {analyticsData.hours.reduce((max, hour) => 
                    hour.transactions > max.transactions ? hour : max
                  ).label}
                </div>
                <div className="text-sm text-gray-600">Meiste Transaktionen</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(
                    analyticsData.hours.reduce((max, hour) => 
                      hour.avgValue > max.avgValue ? hour : max
                    ).avgValue
                  )}
                </div>
                <div className="text-sm text-gray-600">Höchster Durchschnittswert</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderMealTimeAnalysis = () => {
    if (!analyticsData?.mealTimes || !analyticsData?.comparison) return null

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount)
    }

    const lunchData = analyticsData.mealTimes.find(m => m.period === 'lunch')
    const dinnerData = analyticsData.mealTimes.find(m => m.period === 'dinner')

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {analyticsData.mealTimes.map((mealTime) => (
            <Card key={mealTime.period}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  {mealTime.name}
                </CardTitle>
                <CardDescription className="text-sm">
                  {mealTime.timeRange}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(mealTime.totalRevenue)}
                    </p>
                    <p className="text-xs text-gray-500">Gesamtumsatz</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {mealTime.totalTransactions}
                    </p>
                    <p className="text-xs text-gray-500">Transaktionen</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-lg font-semibold">
                      {formatCurrency(mealTime.avgRevenuePerDay)}
                    </p>
                    <p className="text-xs text-gray-500">Ø pro Tag</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {formatCurrency(mealTime.avgTransactionValue)}
                    </p>
                    <p className="text-xs text-gray-500">Ø pro Transaktion</p>
                  </div>
                </div>
                <div className="text-center pt-2 border-t">
                  <p className="text-sm text-gray-600">
                    {mealTime.uniqueDays} Tage mit Verkäufen
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Vergleichsanalyse
            </CardTitle>
            <CardDescription className="text-sm">
              Direkter Vergleich zwischen Mittags- und Abendgeschäft
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {lunchData && dinnerData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {analyticsData.comparison.strongerPeriod === 'dinner' ? 'Abend' : 'Mittag'}
                    </p>
                    <p className="text-sm text-gray-600">Stärkere Zeit</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {analyticsData.comparison.revenueRatio.toFixed(1)}x
                    </p>
                    <p className="text-sm text-gray-600">Umsatz-Verhältnis</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">
                      {analyticsData.comparison.transactionRatio.toFixed(1)}x
                    </p>
                    <p className="text-sm text-gray-600">Transaktions-Verhältnis</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Detailvergleich</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Zeitraum</th>
                          <th className="text-right py-2">Umsatz</th>
                          <th className="text-right py-2">Transaktionen</th>
                          <th className="text-right py-2">Ø pro Tag</th>
                          <th className="text-right py-2">Ø Bon-Wert</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 font-medium">Mittag (12:00-14:30)</td>
                          <td className="text-right py-2">{formatCurrency(lunchData.totalRevenue)}</td>
                          <td className="text-right py-2">{lunchData.totalTransactions}</td>
                          <td className="text-right py-2">{formatCurrency(lunchData.avgRevenuePerDay)}</td>
                          <td className="text-right py-2">{formatCurrency(lunchData.avgTransactionValue)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium">Abend (17:00-23:59)</td>
                          <td className="text-right py-2">{formatCurrency(dinnerData.totalRevenue)}</td>
                          <td className="text-right py-2">{dinnerData.totalTransactions}</td>
                          <td className="text-right py-2">{formatCurrency(dinnerData.avgRevenuePerDay)}</td>
                          <td className="text-right py-2">{formatCurrency(dinnerData.avgTransactionValue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderTimeComparisonChart = () => {
    if (!analyticsData?.periods) return null

    const maxRevenue = Math.max(...analyticsData.periods.flatMap(period => 
      period.hours.map(hour => hour.revenue)
    ))

    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              {timeComparisonPeriod === 'weekly' ? 'Wöchentlicher' : 'Monatlicher'} Zeitvergleich
            </CardTitle>
            <CardDescription className="text-sm">
              Vergleich der Verkaufszeiten über {timeComparisonPeriod === 'weekly' ? 'Wochen' : 'Monate'} hinweg
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 sm:space-y-6">
              {analyticsData.periods.map((period) => (
                <div key={period.period} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-semibold">{period.period}</h3>
                    <div className="text-xs sm:text-sm text-gray-500">
                      {period.hours.reduce((sum, hour) => sum + hour.transactions, 0)} Transaktionen, {' '}
                      {formatCurrency(period.hours.reduce((sum, hour) => sum + hour.revenue, 0))}
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-12 gap-1 min-w-max sm:min-w-0">
                      {period.hours.map((hour) => (
                        <div key={hour.hour} className="text-center">
                          <div className="text-xs text-gray-500 mb-1">{hour.hour}:00</div>
                          <div 
                            className="bg-blue-600 rounded-sm transition-all duration-300"
                            style={{ 
                              height: `${maxRevenue > 0 ? (hour.revenue / maxRevenue) * 100 : 0}px`,
                              minHeight: hour.revenue > 0 ? '4px' : '0px'
                            }}
                            title={`${hour.hour}:00 - ${hour.transactions} Transaktionen, ${formatCurrency(hour.revenue)}`}
                          />
                          <div className="text-xs text-gray-400 mt-1">
                            {hour.transactions > 0 && hour.transactions}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderWeekdayDetailChart = () => {
    if (!analyticsData?.weekdayDetails || !analyticsData?.summary) return null

    const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
    const selectedWeekdayName = weekdayNames[parseInt(selectedWeekday)]
    
    // Find the maximum revenue in the list for proper scaling
    const maxRevenue = Math.max(...analyticsData.weekdayDetails.map(day => day.revenue))

    return (
      <div className="space-y-4">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedWeekdayName} - Zusammenfassung
            </CardTitle>
            <CardDescription>
              Übersicht aller {selectedWeekdayName}e im ausgewählten Zeitraum
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {analyticsData.summary.totalDays}
                </div>
                <div className="text-sm text-gray-600">Anzahl {selectedWeekdayName}e</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(analyticsData.summary.totalRevenue)}
                </div>
                <div className="text-sm text-gray-600">Gesamtumsatz</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(analyticsData.summary.avgRevenuePerDay)}
                </div>
                <div className="text-sm text-gray-600">Ø Umsatz pro {selectedWeekdayName}</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {analyticsData.summary.avgTransactionsPerDay.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Ø Transaktionen pro {selectedWeekdayName}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Individual Days */}
        <Card>
          <CardHeader>
            <CardTitle>Alle {selectedWeekdayName}e im Detail</CardTitle>
            <CardDescription>
              Chronologische Auflistung aller {selectedWeekdayName}e mit Umsätzen und Transaktionen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.weekdayDetails.map((day, index) => (
                <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-gray-500 w-8">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{day.formattedDate}</div>
                      <div className="text-sm text-gray-500">
                        {day.transactions} Transaktionen
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-mono font-bold text-lg">
                        {formatCurrency(day.revenue)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Ø {formatCurrency(day.avgTransactionValue)}
                      </div>
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Lade Analytics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p>Fehler beim Laden der Analytics: {error}</p>
              <Button onClick={fetchAnalytics} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Erneut versuchen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Full Width */}
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
                  onClick={fetchAnalytics}
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
                onClick={fetchAnalytics}
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
          <h1 className="text-2xl font-bold text-gray-900">Verkaufs-Analytics</h1>
          <p className="text-sm text-gray-600">Detaillierte Auswertungen Ihrer Verkäufe</p>
        </div>

        {/* Date Range Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zeitraum auswählen</CardTitle>
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
              <Button onClick={fetchAnalytics} className="w-full sm:w-auto sm:mt-0">
                <TrendingUp className="h-4 w-4 mr-2" />
                Analysieren
              </Button>
            </div>
          </CardContent>
        </Card>

      {/* Tab Navigation - Mobile responsive */}
      <div className="overflow-x-auto">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg min-w-max sm:min-w-0">
        <button
          onClick={() => setActiveTab('weekdays')}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'weekdays'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Wochentage</span>
          <span className="sm:hidden">Tage</span>
        </button>
        <button
          onClick={() => setActiveTab('weekday-detail')}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'weekday-detail'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Activity className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Wochentag-Detail</span>
          <span className="sm:hidden">Detail</span>
        </button>
        <button
          onClick={() => setActiveTab('weeks')}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'weeks'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Kalenderwochen</span>
          <span className="sm:hidden">Wochen</span>
        </button>
        <button
          onClick={() => setActiveTab('hours')}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'hours'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Uhrzeiten</span>
          <span className="sm:hidden">Zeit</span>
        </button>
        <button
          onClick={() => setActiveTab('time-comparison')}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'time-comparison'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Zeitvergleich</span>
          <span className="sm:hidden">Vergleich</span>
        </button>
        <button
          onClick={() => setActiveTab('meal-times')}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'meal-times'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Essenszeiten</span>
          <span className="sm:hidden">Essen</span>
        </button>
        </div>
      </div>

      {/* Weekday Selector for Detail View */}
      {activeTab === 'weekday-detail' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Wochentag auswählen</CardTitle>
            <CardDescription className="text-sm">
              Wähle den Wochentag aus, den du im Detail analysieren möchtest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 sm:space-y-0 sm:flex sm:items-end sm:gap-4">
              <div className="flex-1">
                <Label htmlFor="weekday" className="text-sm">Wochentag:</Label>
                <select
                  id="weekday"
                  value={selectedWeekday}
                  onChange={(e) => setSelectedWeekday(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="1">Montag</option>
                  <option value="2">Dienstag</option>
                  <option value="3">Mittwoch</option>
                  <option value="4">Donnerstag</option>
                  <option value="5">Freitag</option>
                  <option value="6">Samstag</option>
                  <option value="0">Sonntag</option>
                </select>
              </div>
              <Button onClick={fetchAnalytics} className="w-full sm:w-auto sm:mb-0">
                <TrendingUp className="h-4 w-4 mr-2" />
                Analysieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Selector for Time Comparison View */}
      {activeTab === 'time-comparison' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zeitvergleich auswählen</CardTitle>
            <CardDescription className="text-sm">
              Wähle den Zeitraum aus, um zu sehen, wie sich die Verkaufszeiten ändern
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 sm:space-y-0 sm:flex sm:items-end sm:gap-4">
              <div className="flex-1">
                <Label htmlFor="period" className="text-sm">Zeitraum:</Label>
                <select
                  id="period"
                  value={timeComparisonPeriod}
                  onChange={(e) => setTimeComparisonPeriod(e.target.value as 'weekly' | 'monthly')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="weekly">Wöchentlich</option>
                  <option value="monthly">Monatlich</option>
                </select>
              </div>
              <Button onClick={fetchAnalytics} className="w-full sm:w-auto sm:mb-0">
                <TrendingUp className="h-4 w-4 mr-2" />
                Analysieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

        {/* Tab Content */}
        {activeTab === 'weekdays' && renderWeekdayChart()}
        {activeTab === 'weekday-detail' && renderWeekdayDetailChart()}
        {activeTab === 'weeks' && renderWeeklyChart()}
        {activeTab === 'hours' && renderHourlyChart()}
        {activeTab === 'time-comparison' && renderTimeComparisonChart()}
        {activeTab === 'meal-times' && renderMealTimeAnalysis()}
      </div>
    </div>
  )
}