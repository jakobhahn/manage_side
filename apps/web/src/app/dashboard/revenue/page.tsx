'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Loader2, 
  ArrowLeft,
  DollarSign,
  RefreshCw,
  Settings,
  LogOut,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
)

interface TodayData {
  revenue: number
  netto: number
  vat: number
  vat_7?: number  // MwSt 7%
  vat_19?: number // MwSt 19%
  tips: number
  transaction_count: number
}

interface WeeklyData {
  week_start: string
  revenue: number
  netto: number
  transaction_count: number
}

interface MonthlyData {
  month_start: string
  revenue: number
  netto: number
  vat: number
  vat_7?: number  // MwSt 7%
  vat_19?: number // MwSt 19%
  tips: number
  transaction_count: number
}

interface Transaction {
  id: string
  transaction_date: string
  transaction_code: string | null
  amount: number
  netto: number
  vat_amount: number
  tip_amount: number
  status: string | null
  currency: string
}

interface SoldItem {
  name: string
  quantity: number
  revenue: number
  product_id: string | null
}

interface RevenueResponse {
  today: TodayData
  weekly: WeeklyData[]
  monthly: MonthlyData[]
  transactions: Transaction[]
  today_items: SoldItem[]
  weekly_items: Array<{
    week_start: string
    items: SoldItem[]
  }>
  monthly_items: Array<{
    month_start: string
    items: SoldItem[]
  }>
}

export default function RevenuePage() {
  const [revenueData, setRevenueData] = useState<RevenueResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showVatDetail, setShowVatDetail] = useState(false)
  const [vatDetailType, setVatDetailType] = useState<'today' | 'month'>('today')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkAuthAndFetchRevenue()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      fetchRevenueData()
    }
  }, [selectedDate])

  const checkAuthAndFetchRevenue = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Check if user is authenticated
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/login')
        return
      }
      
      // Check if user has permission (owner or manager)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const userData = await response.json()
      
      if (userData.error) {
        throw new Error(userData.error.message)
      }

      if (userData.role !== 'owner' && userData.role !== 'manager') {
        router.push('/dashboard')
        return
      }
      
      await fetchRevenueData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setIsLoading(false)
    }
  }

  const fetchRevenueData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Format date as YYYY-MM-DD
      const dateStr = selectedDate.toISOString().split('T')[0]
      const response = await fetch(`/api/revenue?date=${dateStr}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        console.error('Revenue API error:', data.error)
        throw new Error(data.error.message || data.error)
      }
      
      if (!data.today || !data.weekly || !data.monthly || !data.transactions) {
        console.error('Invalid revenue data structure:', data)
        throw new Error('Invalid response format from revenue API')
      }

      // Ensure items arrays exist (may be missing in older API responses)
      if (!data.today_items) data.today_items = []
      if (!data.weekly_items) data.weekly_items = []
      if (!data.monthly_items) data.monthly_items = []
      
      // Debug logging
      console.log('Revenue data received:', {
        today_items_count: data.today_items?.length || 0,
        weekly_items_count: data.weekly_items?.length || 0,
        monthly_items_count: data.monthly_items?.length || 0,
        today_items: data.today_items
      })
      
      setRevenueData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch revenue data')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatWeek = (weekStart: string) => {
    const date = new Date(weekStart)
    const weekEnd = new Date(date)
    weekEnd.setDate(date.getDate() + 6)
    return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }

  const formatMonth = (monthStart: string) => {
    const date = new Date(monthStart)
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchRevenueData()
    setIsRefreshing(false)
  }

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    // Don't allow going to future dates
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (newDate <= today) {
      setSelectedDate(newDate)
    }
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const isToday = () => {
    const today = new Date()
    return selectedDate.toDateString() === today.toDateString()
  }

  const formatSelectedDate = () => {
    const today = new Date()
    const selected = new Date(selectedDate)
    
    if (selected.toDateString() === today.toDateString()) {
      return 'Heute'
    }
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (selected.toDateString() === yesterday.toDateString()) {
      return 'Gestern'
    }
    
    return selected.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const getWeeklyChartData = () => {
    if (!revenueData?.weekly || revenueData.weekly.length === 0) {
      return null
    }

    const sorted = [...revenueData.weekly].sort((a, b) => 
      new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
    )

    return {
      labels: sorted.map(w => formatWeek(w.week_start)),
      datasets: [
        {
          label: 'Umsatz (Brutto)',
          data: sorted.map(w => w.revenue),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2
        },
        {
          label: 'Netto (ohne Steuer & Trinkgeld)',
          data: sorted.map(w => w.netto),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2
        }
      ]
    }
  }

  const getMonthlyChartData = () => {
    if (!revenueData?.monthly || revenueData.monthly.length === 0) {
      return null
    }

    const sorted = [...revenueData.monthly].sort((a, b) => 
      new Date(a.month_start).getTime() - new Date(b.month_start).getTime()
    )

    return {
      labels: sorted.map(m => formatMonth(m.month_start)),
      datasets: [
        {
          label: 'Umsatz (Brutto)',
          data: sorted.map(m => m.revenue),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2
        },
        {
          label: 'Netto (ohne Steuer & Trinkgeld)',
          data: sorted.map(m => m.netto),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2
        }
      ]
    }
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return `€${value.toFixed(0)}`
          }
        }
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Lade Umsatz-Daten...</span>
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
                <h1 className="text-2xl font-bold text-gray-900">Umsatz Übersicht</h1>
                <p className="text-sm text-gray-600 mt-1">Detaillierte Umsatz-Statistiken</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Aktualisieren"
              >
                <RefreshCw className={`h-5 w-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <Link href="/dashboard/settings">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings className="h-5 w-5 text-gray-600" />
                </button>
              </Link>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Today's Revenue Cards */}
        {revenueData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {formatSelectedDate()}
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousDay}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Vorheriger Tag"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                {!isToday() && (
                  <button
                    onClick={goToToday}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Zu heute"
                  >
                    Heute
                  </button>
                )}
                <button
                  onClick={goToNextDay}
                  disabled={isToday()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Nächster Tag"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Umsatz (Brutto)</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(revenueData.today.revenue)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Netto</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(revenueData.today.netto)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">ohne Steuer & Trinkgeld</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div 
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setVatDetailType('today')
                  setShowVatDetail(true)
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Steuer (MwSt)</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(revenueData.today.vat)}
                    </p>
                    {(revenueData.today.vat_7 !== undefined || revenueData.today.vat_19 !== undefined) && (
                      <p className="text-xs text-gray-500 mt-1">Klicken für Details</p>
                    )}
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Calendar className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Trinkgeld</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(revenueData.today.tips)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Transaktionen</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {revenueData.today.transaction_count}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Sold Items */}
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Verkaufte Artikel</h3>
              </div>
              {revenueData.today_items && revenueData.today_items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Artikel
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Menge
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Umsatz
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {revenueData.today_items.map((item, index) => (
                        <tr key={item.product_id || item.name || index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {item.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-600">
                              {item.quantity.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(item.revenue)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p className="text-sm">Keine verkauften Artikel für diesen Tag gefunden.</p>
                  <p className="text-xs mt-2 text-gray-400">
                    Artikel werden automatisch erstellt, wenn SumUp-Transaktionen synchronisiert werden.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Summary Cards */}
        {revenueData && revenueData.monthly && revenueData.monthly.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Monatliche Übersicht</h2>
            {(() => {
              // Calculate totals for current month (most recent)
              const currentMonth = revenueData.monthly[0]
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Umsatz (Brutto)</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {formatCurrency(currentMonth.revenue)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{formatMonth(currentMonth.month_start)}</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <DollarSign className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Netto</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {formatCurrency(currentMonth.netto)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">ohne Steuer & Trinkgeld</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div 
                    className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setVatDetailType('month')
                      setShowVatDetail(true)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Steuer (MwSt)</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {formatCurrency(currentMonth.vat)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{formatMonth(currentMonth.month_start)}</p>
                        {(currentMonth.vat_7 !== undefined || currentMonth.vat_19 !== undefined) && (
                          <p className="text-xs text-blue-600 mt-1">Klicken für Details</p>
                        )}
                      </div>
                      <div className="p-3 bg-yellow-100 rounded-lg">
                        <Calendar className="h-6 w-6 text-yellow-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Trinkgeld</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {formatCurrency(currentMonth.tips)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{formatMonth(currentMonth.month_start)}</p>
                      </div>
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <DollarSign className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Transaktionen</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {currentMonth.transaction_count}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{formatMonth(currentMonth.month_start)}</p>
                      </div>
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-gray-600" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Weekly Section */}
        {revenueData && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Wöchentliche Übersicht</h2>
            
            {/* Weekly Chart */}
            {getWeeklyChartData() && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Umsatz-Trend (Wochen)</h3>
                <div className="h-80">
                  <Bar data={getWeeklyChartData()!} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Weekly Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Wochen-Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Woche
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Umsatz (Brutto)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Netto
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {revenueData.weekly.map((week) => (
                      <tr key={week.week_start} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatWeek(week.week_start)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(week.revenue)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-600">
                            {formatCurrency(week.netto)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-600">
                            {week.transaction_count}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weekly Sold Items */}
            {revenueData.weekly_items && revenueData.weekly_items.length > 0 && (
              <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">Verkaufte Artikel pro Woche</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {revenueData.weekly_items.map((weekData) => (
                    <div key={weekData.week_start} className="p-6">
                      <h4 className="text-md font-medium text-gray-900 mb-4">
                        {formatWeek(weekData.week_start)}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Artikel
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Menge
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Umsatz
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {weekData.items.map((item, index) => (
                              <tr key={item.product_id || item.name || index} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {item.name}
                                  </div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-600">
                                    {item.quantity.toFixed(2)}
                                  </div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(item.revenue)}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Monthly Section */}
        {revenueData && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Monatliche Übersicht</h2>
            
            {/* Monthly Chart */}
            {getMonthlyChartData() && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Umsatz-Trend (Monate)</h3>
                <div className="h-80">
                  <Bar data={getMonthlyChartData()!} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Monthly Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Monats-Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monat
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Umsatz (Brutto)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Netto
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {revenueData.monthly.map((month) => (
                      <tr key={month.month_start} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatMonth(month.month_start)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(month.revenue)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-600">
                            {formatCurrency(month.netto)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-600">
                            {month.transaction_count}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Sold Items */}
            {revenueData.monthly_items && revenueData.monthly_items.length > 0 && (
              <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">Verkaufte Artikel pro Monat</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {revenueData.monthly_items.map((monthData) => (
                    <div key={monthData.month_start} className="p-6">
                      <h4 className="text-md font-medium text-gray-900 mb-4">
                        {formatMonth(monthData.month_start)}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Artikel
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Menge
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Umsatz
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {monthData.items.map((item, index) => (
                              <tr key={item.product_id || item.name || index} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {item.name}
                                  </div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-600">
                                    {item.quantity.toFixed(2)}
                                  </div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(item.revenue)}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transactions List */}
        {revenueData && revenueData.transactions && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Alle Transaktionen</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Transaktions-Details</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {revenueData.transactions.length} Transaktionen insgesamt
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Datum & Zeit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaktions-Code
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Brutto
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Netto
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Steuer
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trinkgeld
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {revenueData.transactions.map((transaction) => {
                      const dateTime = formatDateTime(transaction.transaction_date)
                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {dateTime.date}
                            </div>
                            <div className="text-xs text-gray-500">
                              {dateTime.time}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {transaction.transaction_code || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(transaction.amount)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {transaction.currency}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-700">
                              {formatCurrency(transaction.netto)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-600">
                              {formatCurrency(transaction.vat_amount)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-600">
                              {transaction.tip_amount > 0 ? (
                                <span className="text-green-600 font-medium">
                                  {formatCurrency(transaction.tip_amount)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {transaction.status ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                transaction.status === 'SUCCESSFUL' || transaction.status === 'successful'
                                  ? 'bg-green-100 text-green-800'
                                  : transaction.status === 'FAILED' || transaction.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : transaction.status === 'PENDING' || transaction.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {transaction.status}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VAT Detail Modal */}
      {showVatDetail && revenueData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  MwSt-Aufteilung {vatDetailType === 'today' ? formatSelectedDate() : formatMonth(revenueData.monthly[0]?.month_start || '')}
                </h2>
                <button
                  onClick={() => setShowVatDetail(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Gesamt MwSt</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(vatDetailType === 'today' ? revenueData.today.vat : (revenueData.monthly[0]?.vat || 0))}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">MwSt 7%</p>
                      <p className="text-xl font-bold text-green-900 mt-1">
                        {formatCurrency(vatDetailType === 'today' ? (revenueData.today.vat_7 || 0) : (revenueData.monthly[0]?.vat_7 || 0))}
                      </p>
                    </div>
                    <div className="text-sm text-green-700">
                      {(vatDetailType === 'today' ? revenueData.today.vat : (revenueData.monthly[0]?.vat || 0)) > 0 ? (
                        <span>
                          {((vatDetailType === 'today' ? (revenueData.today.vat_7 || 0) : (revenueData.monthly[0]?.vat_7 || 0)) / 
                            (vatDetailType === 'today' ? revenueData.today.vat : (revenueData.monthly[0]?.vat || 1)) * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span>0%</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-800">MwSt 19%</p>
                      <p className="text-xl font-bold text-blue-900 mt-1">
                        {formatCurrency(vatDetailType === 'today' ? (revenueData.today.vat_19 || 0) : (revenueData.monthly[0]?.vat_19 || 0))}
                      </p>
                    </div>
                    <div className="text-sm text-blue-700">
                      {(vatDetailType === 'today' ? revenueData.today.vat : (revenueData.monthly[0]?.vat || 0)) > 0 ? (
                        <span>
                          {((vatDetailType === 'today' ? (revenueData.today.vat_19 || 0) : (revenueData.monthly[0]?.vat_19 || 0)) / 
                            (vatDetailType === 'today' ? revenueData.today.vat : (revenueData.monthly[0]?.vat || 1)) * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span>0%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowVatDetail(false)}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
