'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft,
  LogOut,
  Loader2,
  Save,
  Package,
  CheckCircle2,
  XCircle,
  Mail,
  MapPin,
  Phone,
  User,
  FileText,
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

const AVAILABLE_MODULES = [
  { name: 'revenue_analytics', label: 'Revenue Analytics' },
  { name: 'shift_planning', label: 'Shift Planning' },
  { name: 'inventory_management', label: 'Inventory Management' },
  { name: 'time_clock', label: 'Time Clock' },
  { name: 'sales_management', label: 'Sales Management' },
  { name: 'kpi_dashboard', label: 'KPI Dashboard' },
  { name: 'reporting', label: 'Reporting' },
  { name: 'menu_management', label: 'Menu Management' },
  { name: 'prescription_validation', label: 'Rezept-Validierung' }
]

export default function OrganizationDetailPage() {
  const params = useParams()
  const organizationId = params.id as string
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [_user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'modules'>('details')

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    subscription_tier: 'free',
    billing_email: '',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    is_active: true,
    address: '',
    billing_street: '',
    billing_city: '',
    billing_postal_code: '',
    billing_country: 'Deutschland',
    billing_tax_id: '',
    billing_phone: '',
    billing_contact_name: ''
  })

  const [modules, setModules] = useState<Record<string, { is_active: boolean; expires_at: string }>>({})

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkUserAndFetch()
  }, [organizationId])

  const checkUserAndFetch = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

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

      if (userData.role !== 'super_admin') {
        setError('Nur Super-Administratoren haben Zugriff auf diese Seite.')
        setIsLoading(false)
        return
      }

      await fetchOrganization()
    } catch (err) {
      console.error('Error checking user:', err)
      setError('Fehler beim Laden der Benutzerdaten.')
      setIsLoading(false)
    }
  }

  const fetchOrganization = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return
      }

      const token = session.access_token
      const response = await fetch(`/api/admin/organizations/${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Fehler beim Laden der Organisation')
      }

      const data = await response.json()
      const org = data.organization
      setOrganization(org)

      // Populate form data
      setFormData({
        name: org.name || '',
        slug: org.slug || '',
        description: org.description || '',
        subscription_tier: org.subscription_tier || 'free',
        billing_email: org.billing_email || '',
        timezone: org.timezone || 'Europe/Berlin',
        currency: org.currency || 'EUR',
        is_active: org.is_active ?? true,
        address: org.address || '',
        billing_street: org.billing_street || '',
        billing_city: org.billing_city || '',
        billing_postal_code: org.billing_postal_code || '',
        billing_country: org.billing_country || 'Deutschland',
        billing_tax_id: org.billing_tax_id || '',
        billing_phone: org.billing_phone || '',
        billing_contact_name: org.billing_contact_name || ''
      })

      // Populate modules
      const modulesMap: Record<string, { is_active: boolean; expires_at: string }> = {}
      AVAILABLE_MODULES.forEach(module => {
        const subscription = org.module_subscriptions?.find((m: any) => m.module_name === module.name)
        modulesMap[module.name] = {
          is_active: subscription?.is_active ?? false,
          expires_at: subscription?.expires_at || ''
        }
      })
      setModules(modulesMap)

      setError(null)
    } catch (err: any) {
      console.error('Error fetching organization:', err)
      setError(err.message || 'Fehler beim Laden der Organisation')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccess(null)

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Nicht angemeldet')
      }

      const token = session.access_token
      const response = await fetch(`/api/admin/organizations/${organizationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Fehler beim Speichern')
      }

      setSuccess('Organisation erfolgreich aktualisiert')
      await fetchOrganization()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Error saving organization:', err)
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setIsSaving(false)
    }
  }

  const handleModuleToggle = async (moduleName: string, isActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Nicht angemeldet')
      }

      const token = session.access_token
      const expiresAt = modules[moduleName]?.expires_at || null

      const response = await fetch(`/api/admin/organizations/${organizationId}/modules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module_name: moduleName,
          is_active: isActive,
          expires_at: expiresAt || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Fehler beim Aktualisieren des Moduls')
      }

      setModules(prev => ({
        ...prev,
        [moduleName]: {
          ...prev[moduleName],
          is_active: isActive
        }
      }))

      setSuccess(`Modul ${isActive ? 'aktiviert' : 'deaktiviert'}`)
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      console.error('Error toggling module:', err)
      setError(err.message || 'Fehler beim Aktualisieren des Moduls')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    )
  }

  if (error && !organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/dashboard/admin">
            <button className="bg-gray-900 text-white px-4 py-2 rounded-lg">
              Zurück zur Übersicht
            </button>
          </Link>
        </div>
      </div>
    )
  }

  if (!organization) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/admin">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
                <p className="text-sm text-gray-600 mt-1">Organisation verwalten</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchOrganization}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Aktualisieren"
              >
                <RefreshCw className="h-5 w-5 text-gray-600" />
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

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Stammdaten
            </button>
            <button
              onClick={() => setActiveTab('modules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'modules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Module
            </button>
          </nav>
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="md:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Grundinformationen</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Beschreibung
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Tier
                </label>
                <select
                  value={formData.subscription_tier}
                  onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.is_active ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="true">Aktiv</option>
                  <option value="false">Inaktiv</option>
                </select>
              </div>

              {/* Billing Information */}
              <div className="md:col-span-2 mt-6 pt-6 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Rechnungsinformationen</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Rechnungs-E-Mail
                </label>
                <input
                  type="email"
                  value={formData.billing_email}
                  onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Ansprechpartner
                </label>
                <input
                  type="text"
                  value={formData.billing_contact_name}
                  onChange={(e) => setFormData({ ...formData, billing_contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Straße und Hausnummer
                </label>
                <input
                  type="text"
                  value={formData.billing_street}
                  onChange={(e) => setFormData({ ...formData, billing_street: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PLZ
                </label>
                <input
                  type="text"
                  value={formData.billing_postal_code}
                  onChange={(e) => setFormData({ ...formData, billing_postal_code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stadt
                </label>
                <input
                  type="text"
                  value={formData.billing_city}
                  onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Land
                </label>
                <input
                  type="text"
                  value={formData.billing_country}
                  onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="h-4 w-4 inline mr-1" />
                  Telefon
                </label>
                <input
                  type="text"
                  value={formData.billing_phone}
                  onChange={(e) => setFormData({ ...formData, billing_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4 inline mr-1" />
                  Steuernummer / USt-IdNr.
                </label>
                <input
                  type="text"
                  value={formData.billing_tax_id}
                  onChange={(e) => setFormData({ ...formData, billing_tax_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Settings */}
              <div className="md:col-span-2 mt-6 pt-6 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Einstellungen</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zeitzone
                </label>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Währung
                </label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Speichern
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Modules Tab */}
        {activeTab === 'modules' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Module verwalten</h2>
            <p className="text-sm text-gray-600 mb-6">
              Aktivieren oder deaktivieren Sie Module für diese Organisation
            </p>

            <div className="space-y-4">
              {AVAILABLE_MODULES.map((module) => {
                const isActive = modules[module.name]?.is_active ?? false
                return (
                  <div
                    key={module.name}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <Package className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium text-gray-900">{module.label}</div>
                        <div className="text-sm text-gray-500">{module.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inaktiv
                        </span>
                      )}
                      <button
                        onClick={() => handleModuleToggle(module.name, !isActive)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {isActive ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

