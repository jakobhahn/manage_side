'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { 
  Building2, 
  Globe, 
  Save, 
  ArrowLeft, 
  Settings, 
  LogOut,
  Loader2,
  Check,
  MapPin
} from 'lucide-react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  slug: string
  address?: string
  created_at: string
}

interface User {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
  organization_id: string
}

export default function SettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: ''
  })
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
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
        setFormData({
          name: orgData.organization.name,
          slug: orgData.organization.slug,
          address: orgData.organization.address || ''
        })
      }
      
      if (orgData.user) {
        setUser(orgData.user)
        
        // Check if user has permission (owner or manager)
        if (orgData.user.role !== 'owner' && orgData.user.role !== 'manager') {
          router.push('/dashboard')
          return
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(error.message || 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/organizations/me', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update organization')
      }

      setSuccess('Organization updated successfully!')
      setOrganization(data.organization)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading settings...</span>
        </div>
      </div>
    )
  }

  if (!user || (user.role !== 'owner' && user.role !== 'manager')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <Link href="/dashboard" className="text-gray-900 font-medium hover:underline">
            Return to Dashboard
          </Link>
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
                <Link href="/dashboard">
                  <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors mb-2">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Organization Settings</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your organization details
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
                  <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                    <Settings className="h-4 w-4" />
                  </button>
                  
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
              <div className="flex items-center space-x-4">
                <Link href="/dashboard">
                  <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
                  <p className="text-sm text-gray-600">
                    Manage your organization details
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Logged in as</span>
                  <span className="bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-medium">
                    {user?.name} ({user?.role})
                  </span>
                </div>
                
                <button className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                  <Settings className="h-4 w-4" />
                </button>
                
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
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl flat-shadow-lg p-8">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Organization Details</h2>
                  <p className="text-sm text-gray-600">Update your organization information</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-green-800 text-sm">{success}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-700">Organization Name</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="name"
                    type="text"
                    placeholder="My Restaurant"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="slug" className="text-sm font-medium text-gray-700">Organization URL</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="slug"
                    type="text"
                    placeholder="my-restaurant"
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 break-words">
                  hans-app.com/{formData.slug || 'your-slug'}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="address" className="text-sm font-medium text-gray-700">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 h-4 w-4 text-gray-400" />
                  <textarea
                    id="address"
                    placeholder="Enter your restaurant address for weather data..."
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={3}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm resize-none"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  This address will be used to fetch weather data for forecasting and analytics.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium text-sm hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-2">Organization Information</p>
                <div className="space-y-1">
                  <p><span className="font-medium">Created:</span> {organization?.created_at ? new Date(organization.created_at).toLocaleDateString() : 'Unknown'}</p>
                  <p><span className="font-medium">ID:</span> {organization?.id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
