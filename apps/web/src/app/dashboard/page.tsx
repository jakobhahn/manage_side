'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp,
  Clock,
  ShoppingCart,
  BarChart3,
  FileText,
  ChefHat,
  Settings
} from 'lucide-react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  slug: string
  subscription_tier: string
  is_active: boolean
}

interface ModuleSubscription {
  id: string
  module_name: string
  is_active: boolean
  subscription_tier: string
}

export default function DashboardPage() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [modules, setModules] = useState<ModuleSubscription[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch organization data
      const orgResponse = await fetch('/api/organizations/me')
      const orgData = await orgResponse.json()
      
      if (orgData.data) {
        setOrganization(orgData.data)
      }

      // Fetch module subscriptions
      const modulesResponse = await fetch('/api/modules')
      const modulesData = await modulesResponse.json()
      
      if (modulesData.data) {
        setModules(modulesData.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'revenue_analytics':
        return <TrendingUp className="h-5 w-5" />
      case 'shift_planning':
        return <Clock className="h-5 w-5" />
      case 'inventory_management':
        return <ShoppingCart className="h-5 w-5" />
      case 'time_clock':
        return <Clock className="h-5 w-5" />
      case 'sales_management':
        return <DollarSign className="h-5 w-5" />
      case 'kpi_dashboard':
        return <BarChart3 className="h-5 w-5" />
      case 'reporting':
        return <FileText className="h-5 w-5" />
      case 'menu_management':
        return <ChefHat className="h-5 w-5" />
      default:
        return <Settings className="h-5 w-5" />
    }
  }

  const getModuleTitle = (moduleName: string) => {
    switch (moduleName) {
      case 'revenue_analytics':
        return 'Revenue Analytics'
      case 'shift_planning':
        return 'Shift Planning'
      case 'inventory_management':
        return 'Inventory Management'
      case 'time_clock':
        return 'Time Clock'
      case 'sales_management':
        return 'Sales Management'
      case 'kpi_dashboard':
        return 'KPI Dashboard'
      case 'reporting':
        return 'Reporting'
      case 'menu_management':
        return 'Menu Management'
      default:
        return moduleName
    }
  }

  const getModuleDescription = (moduleName: string) => {
    switch (moduleName) {
      case 'revenue_analytics':
        return 'Track revenue, analyze payment methods, and forecast sales'
      case 'shift_planning':
        return 'Manage staff schedules and labor costs'
      case 'inventory_management':
        return 'Track stock levels and manage suppliers'
      case 'time_clock':
        return 'Digital time tracking with GPS verification'
      case 'sales_management':
        return 'Order management and customer database'
      case 'kpi_dashboard':
        return 'Customizable dashboards with real-time metrics'
      case 'reporting':
        return 'Automated reports and compliance documentation'
      case 'menu_management':
        return 'Digital menu management with dynamic pricing'
      default:
        return 'Module description'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
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
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {organization?.subscription_tier || 'Free'} Plan
          </Badge>
          <Button asChild>
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modules.filter(m => m.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {modules.length} available modules
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/dashboard/users" className="text-blue-600 hover:underline">
                Manage users
              </Link>
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/dashboard/revenue" className="text-blue-600 hover:underline">
                View analytics
              </Link>
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/dashboard/shifts" className="text-blue-600 hover:underline">
                View schedule
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modules Grid */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Available Modules</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Card key={module.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getModuleIcon(module.module_name)}
                    <CardTitle className="text-lg">
                      {getModuleTitle(module.module_name)}
                    </CardTitle>
                  </div>
                  <Badge 
                    variant={module.is_active ? "default" : "outline"}
                  >
                    {module.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>
                  {getModuleDescription(module.module_name)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    {module.subscription_tier}
                  </Badge>
                  <Button 
                    variant={module.is_active ? "outline" : "default"}
                    size="sm"
                    asChild
                  >
                    <Link href={`/dashboard/${module.module_name}`}>
                      {module.is_active ? "Open" : "Activate"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
            <Button variant="outline" asChild>
              <Link href="/dashboard/users">
                <Users className="mr-2 h-4 w-4" />
                Add Team Member
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/merchants">
                <Building2 className="mr-2 h-4 w-4" />
                Setup Payment
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/revenue">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Revenue
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
