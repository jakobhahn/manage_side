'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft,
  Building2,
  Search,
  Settings,
  LogOut,
  Loader2,
  Edit,
  Eye,
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  Package,
  RefreshCw
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  subscription_tier: string
  billing_email: string | null
  timezone: string
  currency: string
  is_active: boolean
  trial_ends_at: string | null
  address: string | null
  billing_street: string | null
  billing_city: string | null
  billing_postal_code: string | null
  billing_country: string | null
  billing_tax_id: string | null
  billing_phone: string | null
  billing_contact_name: string | null
  created_at: string
  updated_at: string
  module_subscriptions?: ModuleSubscription[]
}

interface ModuleSubscription {
  id: string
  module_name: string
  is_active: boolean
  subscribed_at: string
  expires_at: string | null
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

export default function AdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkUserAndFetch()
  }, [page, searchQuery, filterActive])

  const checkUserAndFetch = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Get user data
      const token = session.access_token
      const userResponse = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!userResponse.ok) {
        router.push('/login')
        return
      }

      const userData = await userResponse.json()
      setUser(userData)

      // Check if user is super_admin
      if (userData.role !== 'super_admin') {
        setError('Nur Super-Administratoren haben Zugriff auf diese Seite.')
        setIsLoading(false)
        return
      }

      await fetchOrganizations()
    } catch (err) {
      console.error('Error checking user:', err)
      setError('Fehler beim Laden der Benutzerdaten.')
      setIsLoading(false)
    }
  }

  const fetchOrganizations = async () => {
    try {
      setIsRefreshing(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return
      }

      const token = session.access_token
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      if (filterActive !== '') {
        params.append('is_active', filterActive)
      }

      const response = await fetch(`/api/admin/organizations?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Fehler beim Laden der Organisationen')
      }

      const data = await response.json()
      setOrganizations(data.organizations || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
      setError(null)
    } catch (err: any) {
      console.error('Error fetching organizations:', err)
      setError(err.message || 'Fehler beim Laden der Organisationen')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchOrganizations()
  }

  const getActiveModulesCount = (org: Organization) => {
    return org.module_subscriptions?.filter(m => m.is_active).length || 0
  }

  const getAllModulesCount = () => {
    return 8 // Total number of available modules
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/dashboard">
            <button className="bg-gray-900 text-white px-4 py-2 rounded-lg">
              Zurück zum Dashboard
            </button>
          </Link>
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
                <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
                <p className="text-sm text-gray-600 mt-1">Organisationen verwalten</p>
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

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Organisation suchen..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterActive}
            onChange={(e) => {
              setFilterActive(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Alle Status</option>
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-600">Gesamt Organisationen</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{total}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-600">Aktive Organisationen</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {organizations.filter(o => o.is_active).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-600">Inaktive Organisationen</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {organizations.filter(o => !o.is_active).length}
            </div>
          </div>
        </div>

        {/* Organizations List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organisation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Module
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Erstellt
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Keine Organisationen gefunden
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{org.name}</div>
                            <div className="text-sm text-gray-500">{org.slug}</div>
                            {org.billing_email && (
                              <div className="text-xs text-gray-400 flex items-center mt-1">
                                <Mail className="h-3 w-3 mr-1" />
                                {org.billing_email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {org.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aktiv
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inaktiv
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {getActiveModulesCount(org)} / {getAllModulesCount()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(org.created_at).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/dashboard/admin/organizations/${org.id}`}>
                          <button className="text-blue-600 hover:text-blue-900 mr-4">
                            <Eye className="h-5 w-5" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Seite {page} von {totalPages} ({total} Organisationen)
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Zurück
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Weiter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


