'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Loader2, 
  ArrowLeft,
  Calendar,
  RefreshCw,
  Settings,
  LogOut,
  DollarSign,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface DayDistribution {
  date: string
  totalTips: number
  totalHours: number
  employees: Array<{
    userId: string
    userName: string
    hours: number
    tipShare: number
    tipSharePercent: number
  }>
}

interface EmployeeSummary {
  userId: string
  userName: string
  totalTips: number
  totalHours: number
  daysWorked: number
}

interface DistributionResponse {
  distribution: DayDistribution[]
  summary: {
    totalDays: number
    totalTips: number
    totalHours: number
  }
  employeeSummary: EmployeeSummary[]
}

export default function TipsDistributionPage() {
  const [distributionData, setDistributionData] = useState<DistributionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkAuthAndFetchDistribution()
  }, [currentMonth])

  const checkAuthAndFetchDistribution = async () => {
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

      // Fetch distribution data
      await fetchDistribution(session.access_token)
    } catch (error: any) {
      console.error('Failed to fetch distribution:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDistribution = async (token: string) => {
    try {
      // Calculate start and end date for the selected month
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      
      const url = new URL('/api/tips/distribution', window.location.origin)
      url.searchParams.set('start_date', startDate.toISOString().split('T')[0])
      url.searchParams.set('end_date', endDate.toISOString().split('T')[0])

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        console.error('Distribution API error:', errorData)
        throw new Error(errorData.error?.message || `Failed to fetch distribution (status: ${response.status})`)
      }

      const data: DistributionResponse = await response.json()
      setDistributionData(data)
    } catch (error: any) {
      console.error('Failed to fetch distribution:', error)
      setError(error.message)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetchDistribution(session.access_token)
      }
    } catch (error: any) {
      console.error('Failed to refresh distribution:', error)
    } finally {
      setIsRefreshing(false)
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

  const _formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  const getMonthName = () => {
    return currentMonth.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long'
    })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth)
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1)
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1)
    }
    setCurrentMonth(newMonth)
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  // Generate calendar days for the current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay() // 0 = Sunday, 6 = Saturday
    
    // Adjust for Monday = 0 (German week starts on Monday)
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1
    
    const days: Array<{ date: Date, dateStr: string, distribution?: DayDistribution }> = []
    
    // Add empty cells for days before the first day of the month (from previous month)
    // These should NOT have any distribution data
    for (let i = 0; i < adjustedStartDay; i++) {
      const prevMonthDate = new Date(year, month, -adjustedStartDay + i + 1)
      days.push({ 
        date: prevMonthDate, 
        dateStr: '', // Empty dateStr means it's not part of current month
        distribution: undefined // Explicitly no distribution for prev month days
      })
    }
    
    // Add all days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      // Ensure we're using local timezone correctly
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      // Only look for distribution data for days in the current month
      const distribution = distributionData?.distribution.find(d => {
        // Compare dates strictly - only match exact dates in current month
        const distDate = new Date(d.date)
        return distDate.getFullYear() === year && 
               distDate.getMonth() === month && 
               distDate.getDate() === day
      })
      days.push({ date, dateStr, distribution })
    }
    
    return days
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    )
  }

  const calendarDays = getCalendarDays()

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
                <h1 className="text-2xl font-bold text-gray-900">Trinkgeld-Verteilung</h1>
                <p className="text-sm text-gray-600 mt-1">Kalenderansicht mit Trinkgeld-Verteilung nach Arbeitsstunden</p>
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
        {/* Month Navigation */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
                {getMonthName()}
              </h2>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <button
              onClick={goToCurrentMonth}
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
        {distributionData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Gesamt Trinkgeld</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {formatCurrency(distributionData.summary.totalTips)}
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
                  <p className="text-sm font-medium text-gray-600">Gesamt Arbeitsstunden</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {distributionData.summary.totalHours.toFixed(1)}h
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tage mit Daten</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {distributionData.summary.totalDays}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Kalenderansicht</h2>
          </div>
          
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 bg-gray-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              // Only show data for days in the current month
              const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth() && 
                                     day.date.getFullYear() === currentMonth.getFullYear()
              const isToday = day.date.toDateString() === new Date().toDateString()
              // Only show distribution data if it's in the current month
              const hasData = isCurrentMonth && day.distribution && 
                             (day.distribution.totalTips > 0 || day.distribution.employees.length > 0)
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] border-r border-b border-gray-200 p-2 ${
                    !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                  } ${isToday ? 'ring-2 ring-gray-900 ring-inset' : ''}`}
                >
                  {day.dateStr && isCurrentMonth && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${
                          isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                        } ${isToday ? 'text-gray-900 font-bold' : ''}`}>
                          {formatShortDate(day.dateStr)}
                        </span>
                        {hasData && (
                          <span className="text-xs text-green-600 font-medium">
                            {formatCurrency(day.distribution!.totalTips)}
                          </span>
                        )}
                      </div>
                      
                      {hasData && day.distribution && (
                        <div className="mt-2 space-y-1">
                          {day.distribution.employees.slice(0, 3).map((employee) => (
                            <div key={employee.userId} className="text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-700 truncate">{employee.userName}</span>
                                <span className="text-gray-600 ml-1">
                                  {formatCurrency(employee.tipShare)}
                                </span>
                              </div>
                              <div className="text-gray-500 text-[10px]">
                                {employee.hours.toFixed(1)}h ({employee.tipSharePercent.toFixed(1)}%)
                              </div>
                            </div>
                          ))}
                          {day.distribution.employees.length > 3 && (
                            <div className="text-xs text-gray-500 pt-1">
                              +{day.distribution.employees.length - 3} weitere
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Employee Summary Table */}
        {distributionData && distributionData.employeeSummary.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Monatliche Auszahlungen pro Mitarbeiter</h2>
              <p className="text-sm text-gray-600 mt-1">Gesamtes Trinkgeld pro Mitarbeiter für {getMonthName()}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mitarbeiter
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gesamt Trinkgeld
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gesamt Stunden
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tage gearbeitet
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ø Trinkgeld pro Tag
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {distributionData.employeeSummary.map((employee) => (
                    <tr key={employee.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {employee.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.userName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(employee.totalTips)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-600">
                          {employee.totalHours.toFixed(1)}h
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-600">
                          {employee.daysWorked}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-600">
                          {employee.daysWorked > 0 
                            ? formatCurrency(employee.totalTips / employee.daysWorked)
                            : formatCurrency(0)
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">Gesamt</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(
                          distributionData.employeeSummary.reduce((sum, emp) => sum + emp.totalTips, 0)
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {distributionData.employeeSummary.reduce((sum, emp) => sum + emp.totalHours, 0).toFixed(1)}h
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {distributionData.summary.totalDays}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {distributionData.summary.totalDays > 0
                          ? formatCurrency(distributionData.summary.totalTips / distributionData.summary.totalDays)
                          : formatCurrency(0)
                        }
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Day Details Modal could be added here for clicking on a day */}
      </div>
    </div>
  )
}

