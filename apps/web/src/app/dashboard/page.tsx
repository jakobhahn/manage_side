'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { 
  Building2, 
  Users, 
  DollarSign, 
  Clock,
  ShoppingCart,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  Loader2,
  TrendingUp,
  Cloud
} from 'lucide-react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
  organization_id: string
}

export default function DashboardPage() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teamMembersCount, setTeamMembersCount] = useState<number>(0)
  const [totalTransactions, setTotalTransactions] = useState<number>(0)
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null)
  const [todayRevenue, setTodayRevenue] = useState<number>(0)
  const [forecastData, setForecastData] = useState<any>(null)
  const [sumupMessage, setSumupMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    fetchDashboardData()
    
    // Check for SumUp OAuth success/error messages in URL
    const urlParams = new URLSearchParams(window.location.search)
    const sumupSuccess = urlParams.get('sumup_success')
    const sumupError = urlParams.get('sumup_error')
    const errorDescription = urlParams.get('error_description')
    const merchantCode = urlParams.get('merchant_code')
    
    if (sumupSuccess === 'oauth_connected') {
      setSumupMessage({
        type: 'success',
        message: `SumUp OAuth erfolgreich verbunden! Merchant Code: ${merchantCode}`
      })
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (sumupError) {
      setSumupMessage({
        type: 'error',
        message: `SumUp OAuth Fehler: ${errorDescription || sumupError}`
      })
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const fetchTeamMembersCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('No session for team members count')
        return
      }

      console.log('Fetching team members count...')
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('Team members API response:', response.status)
      if (response.ok) {
        const data = await response.json()
        const count = data.users?.length || 0
        console.log('Team members count:', count)
        setTeamMembersCount(count)
      } else {
        console.error('Failed to fetch team members:', response.status)
        setTeamMembersCount(0)
      }
    } catch (err) {
      console.error('Error fetching team members count:', err)
      setTeamMembersCount(0)
    }
  }

  const fetchTransactionStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('No session for transaction stats')
        return
      }

      console.log('Fetching transaction statistics...')
      
      // Fetch monthly data for total transactions
      const monthlyResponse = await fetch('/api/revenue?period=monthly', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      // Fetch daily data for today's revenue
      const dailyResponse = await fetch('/api/revenue?period=daily', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('Transaction stats API responses:', monthlyResponse.status, dailyResponse.status)
      
      if (monthlyResponse.ok) {
        const monthlyData = await monthlyResponse.json()
        const totalTransactions = monthlyData.revenueData?.reduce((sum: number, item: any) => sum + (item.transaction_count || 0), 0) || 0
        console.log('API total transactions:', totalTransactions)
        
        // Don't override direct query results
        console.log('📊 API total transactions:', totalTransactions, '- not setting to avoid override')
        
        // Get the most recent transaction date
        if (monthlyData.revenueData && monthlyData.revenueData.length > 0) {
          const mostRecent = monthlyData.revenueData[0]
          setLastSyncDate(mostRecent.period_start)
        }
      } else {
        console.error('Failed to fetch monthly transaction stats:', monthlyResponse.status)
        // Don't set to 0 if we already have a value from direct query
      }

      if (dailyResponse.ok) {
        const dailyData = await dailyResponse.json()
        // Get today's revenue (most recent day)
        if (dailyData.revenueData && dailyData.revenueData.length > 0) {
          const todayRevenue = dailyData.revenueData[0]?.total_revenue || 0
          console.log('API today\'s revenue:', todayRevenue)
          // Don't override direct query results
          console.log('📊 API today\'s revenue:', todayRevenue, '- not setting to avoid override')
        }
      } else {
        console.error('Failed to fetch daily revenue stats:', dailyResponse.status)
        // Don't set to 0 if we already have a value from direct query
      }
    } catch (err) {
      console.error('Error fetching transaction stats:', err)
      setTotalTransactions(0)
      setTodayRevenue(0)
    }
  }

  const fetchDirectTransactionData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('No session for direct transaction data')
        return
      }

      console.log('Fetching direct transaction data...')
      
      // Get user's organization ID
      const userResponse = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!userResponse.ok) {
        console.error('Failed to get user data for direct transactions')
        return
      }
      
      const userData = await userResponse.json()
      const organizationId = userData.organization_id
      
      if (!organizationId) {
        console.error('No organization ID found for direct transactions')
        return
      }

      // Get today's date range
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      
      // Fetch today's transactions directly from Supabase
      const { data: todayTransactions, error: todayError } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('organization_id', organizationId)
        .gte('transaction_date', startOfDay.toISOString())
        .lt('transaction_date', endOfDay.toISOString())
        .eq('status', 'SUCCESSFUL')

      if (todayError) {
        console.error('❌ Error fetching today\'s transactions:', todayError)
      } else {
        const todayRevenue = todayTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0
        console.log('✅ Direct today\'s revenue:', todayRevenue)
        // Always set the direct revenue
        setTodayRevenue(todayRevenue)
        console.log('🔄 Set todayRevenue to:', todayRevenue)
      }

      // Fetch total transaction count using count() for better performance
      console.log('🔍 Fetching total transactions for organization:', organizationId)
      const { count: totalCount, error: allError } = await supabase
        .from('payment_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'SUCCESSFUL')

      if (allError) {
        console.error('❌ Error fetching total transactions:', allError)
        // Fallback: try to get count by selecting all IDs
        console.log('🔄 Trying fallback method...')
        const { data: allTransactions, error: fallbackError } = await supabase
          .from('payment_transactions')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('status', 'SUCCESSFUL')
        
        if (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError)
        } else {
          const fallbackCount = allTransactions?.length || 0
          console.log('✅ Fallback total transactions:', fallbackCount)
          setTotalTransactions(fallbackCount)
        }
      } else {
        console.log('✅ Direct total transactions (count):', totalCount)
        setTotalTransactions(totalCount || 0)
        console.log('🔄 Set totalTransactions to:', totalCount || 0)
      }

    } catch (err) {
      console.error('Error fetching direct transaction data:', err)
    }
  }

  const fetchForecastData = async (organizationId?: string) => {
    try {
      const orgId = organizationId || organization?.id
      if (!orgId) {
        console.log('No organization ID for forecast data')
        return
      }

      console.log('🔮 Fetching forecast data for organization:', orgId)
      const response = await fetch(`/api/forecast?organizationId=${orgId}`)
      if (response.ok) {
        const data = await response.json()
        setForecastData(data)
        console.log('✅ Forecast data loaded:', data)
      } else {
        console.error('❌ Failed to fetch forecast data:', response.status)
      }
    } catch (error) {
      console.error('❌ Error fetching forecast data:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Check if user is authenticated
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/login')
        return
      }
      
      // Get the current session to include auth headers
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Update last login timestamp
      try {
        const loginResponse = await fetch('/api/users/update-login', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (!loginResponse.ok) {
          console.warn('⚠️ Failed to update login timestamp:', loginResponse.status)
        }
      } catch (loginError) {
        console.warn('⚠️ Login timestamp update failed:', loginError)
      }

      // Fetch organization data
      const orgResponse = await fetch('/api/organizations/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!orgResponse.ok) {
        console.error('❌ Organization API error:', orgResponse.status, orgResponse.statusText)
        if (orgResponse.status === 401) {
          console.error('❌ Unauthorized - redirecting to login')
          router.push('/login')
          return
        }
        const errorText = await orgResponse.text()
        console.error('❌ Organization API error details:', errorText)
        throw new Error(`Failed to fetch organization data: ${orgResponse.status} ${orgResponse.statusText}`)
      }
      
      const orgData = await orgResponse.json()
      
      if (orgData.organization) {
        setOrganization(orgData.organization)
      }
      
      if (orgData.user) {
        setUser(orgData.user)
      }

      // Fetch team members count
      try {
        await fetchTeamMembersCount()
      } catch (error) {
        console.warn('⚠️ Failed to fetch team members count:', error)
      }
      
      // Fetch direct transaction data first (more accurate)
      try {
        await fetchDirectTransactionData()
      } catch (error) {
        console.warn('⚠️ Failed to fetch direct transaction data:', error)
      }
      
      // Fetch transaction statistics as fallback
      try {
        await fetchTransactionStats()
      } catch (error) {
        console.warn('⚠️ Failed to fetch transaction stats:', error)
      }
      
      // Fetch forecast data after organization is set
      if (orgData.organization?.id) {
        try {
          await fetchForecastData(orgData.organization.id)
        } catch (error) {
          console.warn('⚠️ Failed to fetch forecast data:', error)
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Role-based UI rendering

  const renderQuickStats = () => {
    const stats: Array<{
      title: string
      value: string
      icon: any
      link?: string
    }> = [
      {
        title: "Organization",
        value: organization?.name || 'N/A',
        icon: Building2,
        link: undefined
      }
    ]

    // Add role-specific stats
    if (user?.role === 'owner' || user?.role === 'manager') {
      stats.push(
        {
          title: "Team Members",
          value: teamMembersCount.toString(),
          icon: Users,
          link: "/dashboard/users"
        },
        {
          title: "Today's Revenue",
          value: todayRevenue > 0 ? `€${todayRevenue.toFixed(2)}` : "€0.00",
          icon: DollarSign,
          link: "/dashboard/revenue"
        },
        {
          title: "SumUp Transactions",
          value: totalTransactions.toLocaleString(),
          icon: CreditCard,
          link: "/dashboard/sumup"
        },
        {
          title: "Verkaufs-Analytics",
          value: "Auswertungen",
          icon: BarChart3,
          link: "/dashboard/analytics"
        },
        {
          title: "Umsatz-Prognose",
          value: forecastData ? `€${forecastData.forecast?.slice(0, 7).reduce((sum: number, day: any) => sum + day.forecastedRevenue, 0).toFixed(0)}` : "Lädt...",
          icon: TrendingUp,
          link: "/dashboard/forecast"
        },
        {
          title: "Wetter-Sync",
          value: "Hamburg",
          icon: Cloud,
          link: "/dashboard/weather"
        }
      )
    }

    // All roles can see shifts
    stats.push({
      title: "Active Shifts",
      value: "-",
      icon: Clock,
      link: "/dashboard/shifts"
    })

    return stats
  }

  const renderQuickActions = () => {
    const actions: Array<{
      title: string
      description: string
      icon: any
      href?: string
      onClick?: () => void
      variant: 'default' | 'outline'
    }> = []

    // Staff can only see shift-related actions
    if (user?.role === 'staff') {
      actions.push(
        {
          title: "View My Schedule",
          description: "Check your upcoming shifts and schedule",
          icon: Clock,
          href: "/dashboard/shifts",
          variant: "default" as const
        },
        {
          title: "Clock In/Out",
          description: "Record your work hours",
          icon: Clock,
          href: "/dashboard/timeclock",
          variant: "outline" as const
        }
      )
    } else {
      // Owner and Manager see all actions
      actions.push(
        {
          title: "Manage Team",
          description: "Add, edit, or remove team members",
          icon: Users,
          href: "/dashboard/users",
          variant: "default" as const
        },
        {
          title: "View Analytics",
          description: "Check revenue and performance metrics",
          icon: BarChart3,
          href: "/dashboard/revenue",
          variant: "outline" as const
        },
        {
          title: "Schedule Shifts",
          description: "Plan and manage employee schedules",
          icon: Clock,
          href: "/dashboard/shifts",
          variant: "outline" as const
        },
        {
          title: "Manage Inventory",
          description: "Track stock levels and suppliers",
          icon: ShoppingCart,
          href: "/dashboard/inventory",
          variant: "outline" as const
        },
        {
          title: "SumUp Integration",
          description: "Sync payment data and manage merchant accounts",
          icon: CreditCard,
          href: "/dashboard/sumup",
          variant: "outline" as const
        },
      )
    }

    return actions
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
                <h1 className="text-xl font-bold text-gray-900 break-words">
                  {organization?.name || 'Your Restaurant'}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your restaurant operations
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-600">Logged in as</span>
                  <span className="bg-gray-900 text-white px-2 py-1 rounded-full text-xs font-medium">
                    {user?.name} ({user?.role})
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {user?.role === 'owner' || user?.role === 'manager' ? (
                    <Link href="/dashboard/settings">
                      <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <Settings className="h-4 w-4" />
                      </button>
                    </Link>
                  ) : (
                    <Link href="/dashboard/shifts">
                      <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <Settings className="h-4 w-4" />
                      </button>
                    </Link>
                  )}
                  
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
            
            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {organization?.name || 'Your Restaurant'}
                </h1>
                <p className="text-sm text-gray-600">
                  Manage your restaurant operations
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Logged in as</span>
                  <span className="bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-medium">
                    {user?.name} ({user?.role})
                  </span>
                </div>
                
                {user?.role === 'owner' || user?.role === 'manager' ? (
                  <Link href="/dashboard/settings">
                    <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                      <Settings className="h-4 w-4" />
                    </button>
                  </Link>
                ) : (
                  <Link href="/dashboard/shifts">
                    <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                      <Settings className="h-4 w-4" />
                    </button>
                  </Link>
                )}
                
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

        {/* SumUp OAuth Message */}
        {sumupMessage && (
          <div className={`mb-6 p-4 rounded-xl ${
            sumupMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {sumupMessage.type === 'success' ? (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                ) : (
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                )}
                <span className="text-sm font-medium">{sumupMessage.message}</span>
              </div>
              <button 
                onClick={() => setSumupMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {renderQuickStats().map((stat, index) => {
            const IconComponent = stat.icon
            return (
              <div key={index} className="bg-white rounded-2xl flat-shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">{stat.title}</h3>
                  <IconComponent className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-2">{stat.value}</div>
                {stat.link ? (
                  <Link href={stat.link as any} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    {stat.title === "Team Members" ? "Manage users" : 
                     stat.title === "Today's Revenue" ? "View analytics" :
                     stat.title === "Active Shifts" ? "View schedule" : 
                     stat.title === "SumUp Transactions" ? "Sync & manage" : "View details"}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-500">
                    {organization?.slug || 'Restaurant management platform'}
                  </p>
                )}
                {stat.title === "SumUp Transactions" && lastSyncDate && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last sync: {new Date(lastSyncDate).toLocaleDateString('de-DE')}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            <p className="text-sm text-gray-600">Common tasks and shortcuts</p>
          </div>
          <div className="p-6">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {renderQuickActions().map((action, index) => {
                const IconComponent = action.icon
                const content = (
                  <div className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <IconComponent className="h-5 w-5 text-gray-600" />
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{action.title}</h3>
                        <p className="text-xs text-gray-500">{action.description}</p>
                      </div>
                    </div>
                  </div>
                )
                
                if (action.onClick) {
                  return (
                    <div key={index} onClick={action.onClick}>
                      {content}
                    </div>
                  )
                } else {
                  return (
                    <Link key={index} href={action.href as any}>
                      {content}
                    </Link>
                  )
                }
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
