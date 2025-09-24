'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  ArrowLeft,
  BarChart3,
  DollarSign,
  TrendingUp,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'
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

interface TransactionData {
  id: string
  amount: number
  currency: string
  transaction_date: string
  raw_data: any
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
  const supabase = createBrowserClient(
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
    const labels = revenueData.map(item => {
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
          data: revenueData.map(item => item.total_revenue),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2
        }
      ]
    }
  }

  const getTransactionChartData = (): ChartData => {
    const labels = revenueData.map(item => {
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
          data: revenueData.map(item => item.transaction_count),
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revenue Analytics</h1>
            <p className="text-muted-foreground">
              Track your restaurant's financial performance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant={selectedPeriod === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('daily')}
            >
              Daily
            </Button>
            <Button
              variant={selectedPeriod === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('weekly')}
            >
              Weekly
            </Button>
            <Button
              variant={selectedPeriod === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('monthly')}
            >
              Monthly
            </Button>
          </div>
          <LogoutButton />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(getTotalRevenue())}</div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod} view
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalTransactions()}</div>
            <p className="text-xs text-muted-foreground">
              Total transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Transaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(getAverageTransactionValue())}</div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{selectedPeriod}</div>
            <p className="text-xs text-muted-foreground">
              View type
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Details</CardTitle>
          <CardDescription>
            Detailed breakdown of your {selectedPeriod} revenue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <div className="space-y-4">
              {revenueData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{formatDate(item.period_start)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.transaction_count} transactions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{formatCurrency(item.total_revenue)}</div>
                    <Badge variant="outline">
                      {item.period_type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No revenue data available for the selected period.</p>
              <p className="text-sm">Data will appear here once transactions are processed.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>
              Revenue over time for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {revenueData.length > 0 ? (
                <Bar data={getRevenueChartData()} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction Count Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Count</CardTitle>
            <CardDescription>
              Number of transactions over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {revenueData.length > 0 ? (
                <Line data={getTransactionChartData()} options={transactionChartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods Distribution</CardTitle>
          <CardDescription>
            Breakdown of payment methods used by customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="w-80 h-80">
              <Doughnut data={getPaymentMethodData()} options={paymentMethodOptions} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
