'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Loader2, 
  ArrowLeft,
  CreditCard,
  Download,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertCircle,
  Key,
  Copy,
  Check,
  LogOut,
  Plus
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface MerchantCode {
  id: string
  merchant_code: string
  description: string
  is_active: boolean
  created_at: string
  organization_id: string
  sync_status: 'active' | 'inactive' | 'error' | 'syncing'
  last_sync_at: string | null
  webhook_url: string | null
  integration_type: 'oauth' | 'api_key'
  oauth_client_id?: string
  oauth_token_expires_at?: string
}

interface CreateMerchantCodeData {
  merchant_code: string
  description: string
  integration_type: 'oauth' | 'api_key'
  // OAuth fields
  oauth_client_id?: string
  oauth_client_secret?: string
  // API Key fields
  api_key?: string
  api_secret?: string
}

interface SyncResult {
  success: boolean
  transactionsProcessed: number
  message: string
}

export default function SumUpPage() {
  const [merchantCodes, setMerchantCodes] = useState<MerchantCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createFormData, setCreateFormData] = useState<CreateMerchantCodeData>({
    merchant_code: '',
    description: '',
    integration_type: 'api_key',
    api_key: '',
    api_secret: ''
  })
  const [generatedSalt, setGeneratedSalt] = useState<string>('')
  const [saltCopied, setSaltCopied] = useState(false)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    // Set default date range (last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    setToDate(today.toISOString().split('T')[0])
    setFromDate(thirtyDaysAgo.toISOString().split('T')[0])
    
    checkAuthAndFetchData()
  }, [])

  const checkAuthAndFetchData = async () => {
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
      
      await fetchMerchantCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setIsLoading(false)
    }
  }

  const fetchMerchantCodes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/merchant-codes', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format - expected JSON')
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || data.error)
      }
      
      setMerchantCodes(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch merchant codes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    if (!fromDate || !toDate) {
      setError('Please select both from and to dates')
      return
    }

    setIsSyncing(true)
    setError(null)
    setSuccess(null)
    setSyncResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/sumup/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: merchantCodes[0]?.organization_id, // Assuming single org for now
          fromDate,
          toDate
        }),
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format - expected JSON')
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message)
      }
      
      setSyncResult(data)
      setSuccess(`Successfully synced ${data.transactionsProcessed} transactions`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync transactions')
    } finally {
      setIsSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const generateSalt = () => {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const saltHex = Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('')
    setGeneratedSalt(saltHex)
    setSaltCopied(false)
    // Automatically fill the API secret field with the generated salt
    setCreateFormData({ ...createFormData, api_secret: saltHex })
  }

  const copySaltToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedSalt)
      setSaltCopied(true)
      setTimeout(() => setSaltCopied(false), 2000)
    } catch (err) {
      setError('Failed to copy salt to clipboard')
    }
  }

  const handleCreateMerchantCode = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate based on integration type
    if (!createFormData.merchant_code || !createFormData.description) {
      setError('Merchant code and description are required')
      return
    }

    if (createFormData.integration_type === 'oauth') {
      if (!createFormData.oauth_client_id || !createFormData.oauth_client_secret) {
        setError('OAuth Client ID and Client Secret are required')
        return
      }
    } else if (createFormData.integration_type === 'api_key') {
      if (!createFormData.api_key || !createFormData.api_secret) {
        setError('API Key and API Secret are required')
        return
      }
    }

    setIsCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/merchant-codes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createFormData),
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format - expected JSON')
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message)
      }
      
      setSuccess('Merchant code created successfully')
      await fetchMerchantCodes()
      
      // Reset form
      setCreateFormData({
        merchant_code: '',
        description: '',
        integration_type: 'api_key',
        api_key: '',
        api_secret: ''
      })
      setGeneratedSalt('')
      setShowCreateForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create merchant code')
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading SumUp integration...</span>
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
                <h1 className="text-xl font-bold text-gray-900">SumUp Integration</h1>
                <p className="text-sm text-gray-600 mt-1">Manage payment data synchronization and merchant accounts</p>
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  onClick={fetchMerchantCodes}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
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
                  onClick={fetchMerchantCodes}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh</span>
                </button>
                
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SumUp Integration</h1>
          <p className="text-gray-600">Manage payment data synchronization and merchant accounts</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          </div>
        )}

        {/* Add Merchant Code Form */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add New Merchant Account</h2>
                <p className="text-sm text-gray-600">Add a new SumUp merchant account with API credentials</p>
              </div>
              <button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>{showCreateForm ? 'Cancel' : 'Add Account'}</span>
              </button>
            </div>
          </div>
          {showCreateForm && (
            <div className="p-6">
              <form onSubmit={handleCreateMerchantCode} className="space-y-6">
                {/* Integration Type Selection */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">Integration Type</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                        createFormData.integration_type === 'api_key' 
                          ? 'border-gray-900 bg-gray-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setCreateFormData({ ...createFormData, integration_type: 'api_key' })}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          value="api_key"
                          checked={createFormData.integration_type === 'api_key'}
                          onChange={() => setCreateFormData({ ...createFormData, integration_type: 'api_key' })}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-900"
                        />
                        <div>
                          <div className="font-medium text-gray-900">API Key Integration</div>
                          <div className="text-sm text-gray-500">
                            Use SumUp API keys for direct integration
                          </div>
                        </div>
                      </div>
                    </div>
                    <div 
                      className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                        createFormData.integration_type === 'oauth' 
                          ? 'border-gray-900 bg-gray-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setCreateFormData({ ...createFormData, integration_type: 'oauth' })}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          value="oauth"
                          checked={createFormData.integration_type === 'oauth'}
                          onChange={() => setCreateFormData({ ...createFormData, integration_type: 'oauth' })}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-900"
                        />
                        <div>
                          <div className="font-medium text-gray-900">OAuth Integration</div>
                          <div className="text-sm text-gray-500">
                            Use OAuth for secure, token-based access
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Merchant Code</label>
                    <input
                      type="text"
                      value={createFormData.merchant_code}
                      onChange={(e) => setCreateFormData({ ...createFormData, merchant_code: e.target.value })}
                      placeholder="e.g., 123456789"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <input
                      type="text"
                      value={createFormData.description}
                      onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                      placeholder="e.g., Main Restaurant POS"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                      required
                    />
                  </div>
                </div>

              {/* OAuth Fields */}
              {createFormData.integration_type === 'oauth' && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">OAuth Configuration</h4>
                    <p className="text-sm text-blue-700 mb-4">
                      Configure OAuth credentials from your SumUp developer dashboard.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="oauth_client_id">Client ID</Label>
                        <Input
                          id="oauth_client_id"
                          value={createFormData.oauth_client_id || ''}
                          onChange={(e) => setCreateFormData({ ...createFormData, oauth_client_id: e.target.value })}
                          placeholder="Enter OAuth Client ID"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="oauth_client_secret">Client Secret</Label>
                        <Input
                          id="oauth_client_secret"
                          type="password"
                          value={createFormData.oauth_client_secret || ''}
                          onChange={(e) => setCreateFormData({ ...createFormData, oauth_client_secret: e.target.value })}
                          placeholder="Enter OAuth Client Secret"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Key Fields */}
              {createFormData.integration_type === 'api_key' && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">API Key Configuration</h4>
                    <p className="text-sm text-green-700 mb-4">
                      Use your SumUp API credentials for direct integration.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="api_key">API Key</Label>
                        <Input
                          id="api_key"
                          type="password"
                          value={createFormData.api_key || ''}
                          onChange={(e) => setCreateFormData({ ...createFormData, api_key: e.target.value })}
                          placeholder="Enter SumUp API Key"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="api_secret">API Secret (Salt)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="api_secret"
                            type="password"
                            value={createFormData.api_secret || ''}
                            onChange={(e) => setCreateFormData({ ...createFormData, api_secret: e.target.value })}
                            placeholder="Enter SumUp API Secret or generate a salt"
                            required
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={generateSalt}
                            className="px-3"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        </div>
                        {generatedSalt && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-green-600">Generated Salt:</Label>
                            <div className="flex gap-2">
                              <Input
                                value={generatedSalt}
                                readOnly
                                className="font-mono text-xs bg-gray-50"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={copySaltToClipboard}
                                className="px-3"
                              >
                                {saltCopied ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Click the key icon to generate a strong salt, then copy it to use as your API Secret
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </div>
            </form>
            </div>
          )}
        </div>

        {/* Merchant Codes */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Merchant Accounts ({merchantCodes.length})</h2>
            <p className="text-sm text-gray-600">Configured SumUp merchant accounts for payment processing</p>
          </div>
          <div className="divide-y divide-gray-200">
            {merchantCodes.length > 0 ? (
              merchantCodes.map((merchant) => (
                <div key={merchant.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-medium text-gray-900">{merchant.merchant_code}</h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            merchant.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {merchant.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            merchant.sync_status === 'active' ? 'bg-green-100 text-green-700' :
                            merchant.sync_status === 'error' ? 'bg-red-100 text-red-700' :
                            merchant.sync_status === 'syncing' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {merchant.sync_status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{merchant.description}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500">Created: {formatDate(merchant.created_at)}</span>
                          {merchant.last_sync_at && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs text-gray-500">Last sync: {formatDate(merchant.last_sync_at)}</span>
                            </>
                          )}
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-500">{merchant.integration_type === 'oauth' ? 'OAuth' : 'API Key'}</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No merchant accounts configured.</p>
                <p className="text-sm text-gray-500">Contact support to set up your SumUp integration.</p>
              </div>
            )}
          </div>
        </div>

        {/* Data Synchronization */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Data Synchronization</h2>
            <p className="text-sm text-gray-600">Sync payment transactions from SumUp to your dashboard</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  />
                </div>
              </div>
            
              <button 
                onClick={handleSync}
                disabled={isSyncing || merchantCodes.length === 0}
                className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Sync Transactions</span>
                  </>
                )}
              </button>

              {syncResult && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <h4 className="font-medium text-green-900 mb-2">Sync Complete</h4>
                  <p className="text-sm text-green-700">
                    {syncResult.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Webhook Configuration</h2>
            <p className="text-sm text-gray-600">Real-time transaction updates via SumUp webhooks</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <h4 className="font-medium text-gray-900 mb-2">Webhook URL</h4>
                <code className="text-sm bg-white p-3 rounded-xl border border-gray-200 block text-gray-700">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/sumup` : 'https://your-domain.com/api/webhooks/sumup'}
                </code>
              </div>
              <div className="text-sm text-gray-500">
                <p>Configure this URL in your SumUp merchant dashboard to receive real-time transaction updates.</p>
                <p className="mt-2">Events: <code className="bg-gray-100 px-2 py-1 rounded text-xs">transaction.created</code>, <code className="bg-gray-100 px-2 py-1 rounded text-xs">transaction.updated</code></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

