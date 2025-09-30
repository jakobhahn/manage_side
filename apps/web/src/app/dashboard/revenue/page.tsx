'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Loader2, 
  ArrowLeft,
  BarChart3,
  DollarSign,
  TrendingUp,
  Calendar,
  RefreshCw,
  Settings,
  LogOut
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
)

interface RevenueData {
  period_type: 'daily' | 'weekly' | 'monthly'
  period_start: string
  total_revenue: number
  transaction_count: number
}

interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }[]
}

export default function RevenuePage() {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkAuthAndFetchRevenue()
  }, [selectedPeriod])

  const checkAuthAndFetchRevenue = async () => {
    try {
      setIsLoading(true)
      
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

      const response = await fetch(`/api/revenue?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || data.error)
      }
      
      setRevenueData(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch revenue data')
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (selectedPeriod === 'daily') {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })
    } else if (selectedPeriod === 'weekly') {
      const weekEnd = new Date(date)
      weekEnd.setDate(date.getDate() + 6)
      return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    } else {
      return date.toLocaleDateString('de-DE', { 
        month: 'long', 
        year: 'numeric' 
      })
    }
  }

  const getTotalRevenue = () => {
    return revenueData.reduce((sum, item) => sum + item.total_revenue, 0)
  }

  const getTotalTransactions = () => {
    return revenueData.reduce((sum, item) => sum + item.transaction_count, 0)
  }

  const getAverageTransactionValue = () => {
    const total = getTotalRevenue()
    const count = getTotalTransactions()
    return count > 0 ? total / count : 0
  }

  const getRevenueChartData = (): ChartData => {
    // Sort data by period_start date (chronological order)
    const sortedData = [...revenueData].sort((a, b) => 
      new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
    )

    const labels = sortedData.map(item => {
      const date = new Date(item.period_start)
      if (selectedPeriod === 'daily') {
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
      } else if (selectedPeriod === 'weekly') {
        const weekEnd = new Date(date)
        weekEnd.setDate(date.getDate() + 6)
        return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
      } else {
        return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      }
    })

    return {
      labels,
      datasets: [
        {
          label: 'Revenue (€)',
          data: sortedData.map(item => item.total_revenue),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2
        }
      ]
    }
  }

  const getTransactionChartData = (): ChartData => {
    // Sort data by period_start date (chronological order)
    const sortedData = [...revenueData].sort((a, b) => 
      new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
    )

    const labels = sortedData.map(item => {
      const date = new Date(item.period_start)
      if (selectedPeriod === 'daily') {
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
      } else if (selectedPeriod === 'weekly') {
        const weekEnd = new Date(date)
        weekEnd.setDate(date.getDate() + 6)
        return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
      } else {
        return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      }
    })

    return {
      labels,
      datasets: [
        {
          label: 'Transactions',
          data: sortedData.map(item => item.transaction_count),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2
        }
      ]
    }
  }

  const getPaymentMethodData = (): ChartData => {
    // Mock data for payment methods - in real implementation, this would come from transaction data
    const paymentMethods = ['Card', 'Cash', 'Mobile', 'Other']
    const amounts = [65, 20, 10, 5] // percentages

    return {
      labels: paymentMethods,
      datasets: [
        {
          label: 'Payment Methods (%)',
          data: amounts,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 2
        }
      ]
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchRevenueData()
    setIsRefreshing(false)
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Revenue Analytics - ${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} View`
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return selectedPeriod === 'daily' || selectedPeriod === 'weekly' 
              ? `€${value}` 
              : `€${value}`
          }
        }
      }
    }
  }

  const transactionChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Transaction Count - ${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} View`
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  }

  const paymentMethodOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: 'Payment Methods Distribution'
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading revenue data...</span>
        </div>
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
              <div className="mb-4">
                <Link 
                  href="/dashboard" 
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors mb-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Back to Dashboard</span>
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Revenue Analytics</h1>
                <p className="text-sm text-gray-600 mt-1">Track your restaurant's financial performance</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden xs:inline">Refresh</span>
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <Link href="/dashboard/settings">
                      <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <Settings className="h-4 w-4" />
                      </button>
                    </Link>
                    
                    <button 
                      onClick={async () => {
                        await supabase.auth.signOut()
                        router.push('/login')
                      }}
                      className="bg-red-600 text-white p-2 rounded-xl hover:bg-red-700 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setSelectedPeriod('daily')}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedPeriod === 'daily' 
                        ? 'bg-white text-gray-900 flat-shadow' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('weekly')}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedPeriod === 'weekly' 
                        ? 'bg-white text-gray-900 flat-shadow' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('monthly')}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedPeriod === 'monthly' 
                        ? 'bg-white text-gray-900 flat-shadow' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
            </div>
            
            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard" 
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Back to Dashboard</span>
                </Link>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                
                <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setSelectedPeriod('daily')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedPeriod === 'daily' 
                        ? 'bg-white text-gray-900 flat-shadow' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('weekly')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedPeriod === 'weekly' 
                        ? 'bg-white text-gray-900 flat-shadow' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('monthly')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedPeriod === 'monthly' 
                        ? 'bg-white text-gray-900 flat-shadow' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
                
                <Link href="/dashboard/settings">
                  <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                    <Settings className="h-4 w-4" />
                  </button>
                </Link>
                
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut()
                    router.push('/login')
                  }}
                  className="bg-red-600 text-white p-2 rounded-xl hover:bg-red-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Title - Full Width */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Revenue Analytics</h1>
          <p className="text-gray-600">Track your restaurant's financial performance</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white rounded-2xl flat-shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">{formatCurrency(getTotalRevenue())}</div>
            <p className="text-sm text-gray-500">{selectedPeriod} view</p>
          </div>

          <div className="bg-white rounded-2xl flat-shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Transactions</h3>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">{getTotalTransactions()}</div>
            <p className="text-sm text-gray-500">Total transactions</p>
          </div>

          <div className="bg-white rounded-2xl flat-shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Avg. Transaction</h3>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">{formatCurrency(getAverageTransactionValue())}</div>
            <p className="text-sm text-gray-500">Per transaction</p>
          </div>

          <div className="bg-white rounded-2xl flat-shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Period</h3>
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2 capitalize">{selectedPeriod}</div>
            <p className="text-sm text-gray-500">View type</p>
          </div>
        </div>

        {/* Revenue Data Table */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Revenue Details</h2>
            <p className="text-sm text-gray-600">Detailed breakdown of your {selectedPeriod} revenue</p>
          </div>
          <div className="p-6">
            {revenueData.length > 0 ? (
              <div className="space-y-4">
                {revenueData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{formatDate(item.period_start)}</h3>
                        <p className="text-sm text-gray-500">
                          {item.transaction_count} transactions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(item.total_revenue)}</div>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {item.period_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No revenue data available for the selected period.</p>
                <p className="text-sm">Data will appear here once transactions are processed.</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Revenue Trend</h2>
              <p className="text-sm text-gray-600">Revenue over time for the selected period</p>
            </div>
            <div className="p-6">
              <div className="h-80">
                {revenueData.length > 0 ? (
                  <Bar data={getRevenueChartData()} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Count Chart */}
          <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Transaction Count</h2>
              <p className="text-sm text-gray-600">Number of transactions over time</p>
            </div>
            <div className="p-6">
              <div className="h-80">
                {revenueData.length > 0 ? (
                  <Line data={getTransactionChartData()} options={transactionChartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods Chart */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Payment Methods Distribution</h2>
            <p className="text-sm text-gray-600">Breakdown of payment methods used by customers</p>
          </div>
          <div className="p-6">
            <div className="h-80 flex items-center justify-center">
              <div className="w-80 h-80">
                <Doughnut data={getPaymentMethodData()} options={paymentMethodOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
