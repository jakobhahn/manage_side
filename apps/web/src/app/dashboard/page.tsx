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
  Loader2
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    fetchDashboardData()
  }, [])

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
      await fetch('/api/users/update-login', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      // Fetch organization data
      const orgResponse = await fetch('/api/organizations/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!orgResponse.ok) {
        if (orgResponse.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch organization data')
      }
      
      const orgData = await orgResponse.json()
      
      if (orgData.organization) {
        setOrganization(orgData.organization)
      }
      
      if (orgData.user) {
        setUser(orgData.user)
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
          value: "-",
          icon: Users,
          link: "/dashboard/users"
        },
        {
          title: "Today's Revenue",
          value: "-",
          icon: DollarSign,
          link: "/dashboard/revenue"
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
    const actions = []

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
        }
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
                     stat.title === "Active Shifts" ? "View schedule" : "View details"}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-500">
                    {organization?.slug || 'Restaurant management platform'}
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
                return (
                  <Link key={index} href={action.href as any}>
                    <div className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <IconComponent className="h-5 w-5 text-gray-600" />
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{action.title}</h3>
                          <p className="text-xs text-gray-500">{action.description}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
