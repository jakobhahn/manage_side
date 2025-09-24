'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  Users, 
  DollarSign, 
  Clock,
  ShoppingCart,
  BarChart3,
  Settings,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

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
  const supabase = createBrowserClient(
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <Button onClick={fetchDashboardData} className="mt-4">
            Try Again
          </Button>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to {organization?.name || 'Your Restaurant'}
          </h1>
          <p className="text-muted-foreground">
            Manage your restaurant operations with our modular platform
          </p>
          {user && (
            <p className="text-sm text-gray-600 mt-1">
              Logged in as {user.name} ({user.role})
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {user?.role || 'User'}
          </Badge>
          {user?.role === 'owner' || user?.role === 'manager' ? (
            <Button asChild>
              <Link href="/dashboard/users">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/shifts">
                <Settings className="mr-2 h-4 w-4" />
                My Schedule
              </Link>
            </Button>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {renderQuickStats().map((stat, index) => {
          const IconComponent = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.link ? (
                    <Link href={stat.link as any} className="text-blue-600 hover:underline">
                      {stat.title === "Team Members" ? "Manage users" : 
                       stat.title === "Today's Revenue" ? "View analytics" :
                       stat.title === "Active Shifts" ? "View schedule" : "View details"}
                    </Link>
                  ) : (
                    organization?.slug || 'Restaurant management platform'
                  )}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {renderQuickActions().map((action, index) => {
              const IconComponent = action.icon
              return (
                <Button key={index} variant={action.variant} asChild>
                  <Link href={action.href as any}>
                    <IconComponent className="mr-2 h-4 w-4" />
                    {action.title}
                  </Link>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
