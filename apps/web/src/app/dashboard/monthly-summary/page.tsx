'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, TrendingUp, AlertCircle, Download, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface MonthlySummary {
  organization_id: string
  user_id: string
  employee_name: string
  month: string
  year: number
  month_number: number
  vacation_days: number
  sick_days: number
  worked_hours_brutto: number
  worked_hours_netto: number
  break_hours: number
  break_hours_actual: number
  break_hours_required: number
  worked_days: number
  total_entries: number
}

interface UserData {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
}

export default function MonthlySummaryPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [summary, setSummary] = useState<MonthlySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null) // null = all months

  useEffect(() => {
    fetchUserAndSummary()
  }, [selectedYear, selectedMonth])

  const fetchUserAndSummary = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('auth_id', session.user.id)
        .single()

      if (userData) {
        setUser(userData as UserData)
        await fetchSummary(session.access_token, userData.id, userData.role)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSummary = async (token: string, userId: string, role: string) => {
    try {
      let url = `/api/vacation/monthly-summary?year=${selectedYear}`
      if (selectedMonth) {
        url += `&month=${selectedMonth}`
      }
      if (role === 'staff') {
        url += `&user_id=${userId}`
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Monthly summary data:', data) // Debug log
        setSummary(data.summary || [])
      } else {
        const errorData = await response.json()
        console.error('Error response:', errorData)
      }
    } catch (error) {
      console.error('Error fetching monthly summary:', error)
    }
  }

  const formatMonth = (monthNumber: number) => {
    const months = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ]
    return months[monthNumber - 1] || ''
  }

  const groupByEmployee = (data: MonthlySummary[]) => {
    const grouped: Record<string, MonthlySummary[]> = {}
    data.forEach(item => {
      if (!grouped[item.user_id]) {
        grouped[item.user_id] = []
      }
      grouped[item.user_id].push(item)
    })
    return grouped
  }

  const calculateTotals = (items: MonthlySummary[]) => {
    return {
      vacation_days: items.reduce((sum, item) => sum + item.vacation_days, 0),
      sick_days: items.reduce((sum, item) => sum + item.sick_days, 0),
      worked_hours_brutto: items.reduce((sum, item) => sum + item.worked_hours_brutto, 0),
      worked_hours_netto: items.reduce((sum, item) => sum + item.worked_hours_netto, 0),
      break_hours: items.reduce((sum, item) => sum + item.break_hours, 0),
      worked_days: items.reduce((sum, item) => sum + item.worked_days, 0)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </div>
    )
  }

  const isManager = user?.role === 'owner' || user?.role === 'manager'
  const grouped = groupByEmployee(summary)
  const totals = calculateTotals(summary)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Monatsübersicht</h1>
              <p className="text-sm text-gray-600">Übersicht über Urlaubstage, Arbeitsstunden und Krankheitstage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jahr
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monat (optional)
              </label>
              <select
                value={selectedMonth || ''}
                onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="">Alle Monate</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>{formatMonth(month)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Totals */}
        {summary.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Urlaubstage</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{totals.vacation_days.toFixed(1)}</div>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Krankheitstage</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{totals.sick_days}</div>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Arbeitsstunden (Netto)</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{totals.worked_hours_netto.toFixed(1)}</div>
                  <div className="text-xs text-gray-500 mt-1">Brutto: {totals.worked_hours_brutto.toFixed(1)}h</div>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Arbeitstage</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{totals.worked_days}</div>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        )}

        {/* Employee Summary Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {isManager ? 'Mitarbeiter-Übersicht' : 'Meine Übersicht'}
            </h2>
          </div>
          {Object.keys(grouped).length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Keine Daten für den ausgewählten Zeitraum vorhanden
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mitarbeiter
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monat
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Urlaubstage
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Krankheitstage
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arbeitsstunden (Brutto)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pause
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arbeitsstunden (Netto)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arbeitstage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(grouped).map(([userId, items]) => {
                    const employeeTotals = calculateTotals(items)
                    const firstItem = items[0]
                    return (
                      <>
                        {items.map((item, index) => (
                          <tr key={`${item.user_id}-${item.month}`} className={index === 0 ? 'bg-gray-50' : ''}>
                            {index === 0 && (
                              <td rowSpan={items.length} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.employee_name}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatMonth(item.month_number)} {item.year}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.vacation_days.toFixed(1)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.sick_days}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.worked_hours_brutto.toFixed(1)}h
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                              {item.break_hours.toFixed(2)}h
                              {item.break_hours_actual > 0 && (
                                <span className="text-xs text-gray-500 block">
                                  (erfasst: {item.break_hours_actual.toFixed(2)}h)
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {item.worked_hours_netto.toFixed(1)}h
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.worked_days}
                            </td>
                          </tr>
                        ))}
                        {items.length > 1 && (
                          <tr className="bg-blue-50 font-semibold">
                            <td colSpan={2} className="px-6 py-3 text-sm text-gray-900">
                              Gesamt ({firstItem.employee_name})
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900 text-right">
                              {employeeTotals.vacation_days.toFixed(1)}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900 text-right">
                              {employeeTotals.sick_days}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900 text-right">
                              {employeeTotals.worked_hours_brutto.toFixed(1)}h
                            </td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-600 text-right">
                              {employeeTotals.break_hours.toFixed(2)}h
                            </td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">
                              {employeeTotals.worked_hours_netto.toFixed(1)}h
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900 text-right">
                              {employeeTotals.worked_days}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

