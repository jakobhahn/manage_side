'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Loader2, 
  ArrowLeft,
  DollarSign,
  Calendar,
  RefreshCw,
  Settings,
  LogOut,
  TrendingUp
} from 'lucide-react'

interface TipMonth {
  month: string // Format: "YYYY-MM"
  monthName: string // Format: "Januar 2024"
  totalTips: number
  transactionCount: number
  averageTip: number
}

interface TipsResponse {
  tips: TipMonth[]
  totals: {
    totalTips: number
    totalTransactions: number
    averageTip: number
  }
}

export default function TipsPage() {
  const [tipsData, setTipsData] = useState<TipsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1) // 1-12
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkAuthAndFetchTips()
  }, [selectedYear, selectedMonth])

  const checkAuthAndFetchTips = async () => {
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

      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }

      await response.json()

      // Fetch tips data
      await fetchTips(session.access_token)
    } catch (error: any) {
      console.error('Failed to fetch tips:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTips = async (token: string) => {
    try {
      // Calculate start and end date for the selected month
      const startDate = new Date(selectedYear, selectedMonth - 1, 1)
      const endDate = new Date(selectedYear, selectedMonth, 0) // Last day of the month
      
      const url = new URL('/api/tips', window.location.origin)
      url.searchParams.set('start_date', startDate.toISOString().split('T')[0])
      url.searchParams.set('end_date', endDate.toISOString().split('T')[0])
      url.searchParams.set('group_by', 'month') // Request monthly grouping

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        console.error('Tips API error:', errorData)
        throw new Error(errorData.error?.message || `Failed to fetch tips (status: ${response.status})`)
      }

      const data: TipsResponse = await response.json()
      setTipsData(data)
    } catch (error: any) {
      console.error('Failed to fetch tips:', error)
      setError(error.message)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetchTips(session.access_token)
      }
    } catch (error: any) {
      console.error('Failed to refresh tips:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const formatMonth = (monthString: string) => {
    // monthString is "YYYY-MM"
    const [year, month] = monthString.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long'
    })
  }

  const getMonthOptions = () => {
    const months = []
    for (let i = 1; i <= 12; i++) {
      const date = new Date(selectedYear, i - 1, 1)
      months.push({
        value: i,
        label: date.toLocaleDateString('de-DE', { month: 'long' })
      })
    }
    return months
  }

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i)
    }
    return years
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
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
                <h1 className="text-2xl font-bold text-gray-900">Trinkgeld Übersicht</h1>
                <p className="text-sm text-gray-600 mt-1">Monatliche Trinkgeld-Statistiken</p>
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
        {/* Month Selector */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center space-x-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Monat:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 text-sm bg-white"
            >
              {getMonthOptions().map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium text-gray-700">Jahr:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 text-sm bg-white"
            >
              {getYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <div className="flex-1"></div>
            <button
              onClick={() => {
                const today = new Date()
                setSelectedMonth(today.getMonth() + 1)
                setSelectedYear(today.getFullYear())
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Aktueller Monat
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        {tipsData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Gesamt Trinkgeld</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {formatCurrency(tipsData.totals.totalTips)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transaktionen mit Trinkgeld</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {tipsData.totals.totalTransactions}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Durchschnitt pro Monat</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {formatCurrency(tipsData.totals.averageTip)}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Tips Table */}
        {tipsData && tipsData.tips.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Trinkgeld pro Monat</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monat
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gesamt Trinkgeld
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaktionen
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durchschnitt pro Transaktion
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tipsData.tips.map((month) => (
                    <tr key={month.month} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {month.monthName || formatMonth(month.month)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(month.totalTips)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-600">
                          {month.transactionCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-600">
                          {formatCurrency(month.averageTip || (month.transactionCount > 0 ? month.totalTips / month.transactionCount : 0))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tipsData && tipsData.tips.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Keine Trinkgeld-Daten gefunden
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Im ausgewählten Zeitraum wurden keine Transaktionen mit Trinkgeld gefunden.
            </p>
            {tipsData && (tipsData as any).debug && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                <p className="text-sm font-medium text-yellow-800 mb-2">Debug-Information:</p>
                <p className="text-xs text-yellow-700">
                  {(tipsData as any).debug.message || 'Bitte prüfen Sie die Server-Logs für Details.'}
                </p>
                {(tipsData as any).debug.totalTransactions && (
                  <p className="text-xs text-yellow-700 mt-2">
                    Gefundene Transaktionen: {(tipsData as any).debug.totalTransactions}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-4">
              Bitte prüfen Sie die Browser-Konsole und Server-Logs für weitere Details.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

