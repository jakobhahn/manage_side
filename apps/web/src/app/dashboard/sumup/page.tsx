'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  ArrowLeft,
  CreditCard,
  Download,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'

interface MerchantCode {
  id: string
  merchant_code: string
  description: string
  is_active: boolean
  created_at: string
  sync_status: 'active' | 'inactive' | 'error' | 'syncing'
  last_sync_at: string | null
  webhook_url: string | null
}

interface CreateMerchantCodeData {
  merchant_code: string
  description: string
  api_key: string
  api_secret: string
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
    api_key: '',
    api_secret: ''
  })
  const supabase = createBrowserClient(
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

  const handleCreateMerchantCode = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!createFormData.merchant_code || !createFormData.description || !createFormData.api_key || !createFormData.api_secret) {
      setError('All fields are required')
      return
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
        api_key: '',
        api_secret: ''
      })
      setShowCreateForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create merchant code')
    } finally {
      setIsCreating(false)
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
            <h1 className="text-3xl font-bold tracking-tight">SumUp Integration</h1>
            <p className="text-muted-foreground">
              Manage payment data synchronization and merchant accounts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchMerchantCodes}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <LogoutButton />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Add Merchant Code Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Add New Merchant Account
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : 'Add Account'}
            </Button>
          </CardTitle>
          <CardDescription>
            Add a new SumUp merchant account with API credentials
          </CardDescription>
        </CardHeader>
        {showCreateForm && (
          <CardContent>
            <form onSubmit={handleCreateMerchantCode} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="merchant_code">Merchant Code</Label>
                  <Input
                    id="merchant_code"
                    value={createFormData.merchant_code}
                    onChange={(e) => setCreateFormData({ ...createFormData, merchant_code: e.target.value })}
                    placeholder="e.g., 123456789"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                    placeholder="e.g., Main Restaurant POS"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={createFormData.api_key}
                    onChange={(e) => setCreateFormData({ ...createFormData, api_key: e.target.value })}
                    placeholder="Enter SumUp API Key"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_secret">API Secret</Label>
                  <Input
                    id="api_secret"
                    type="password"
                    value={createFormData.api_secret}
                    onChange={(e) => setCreateFormData({ ...createFormData, api_secret: e.target.value })}
                    placeholder="Enter SumUp API Secret"
                    required
                  />
                </div>
              </div>
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
          </CardContent>
        )}
      </Card>

      {/* Merchant Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Merchant Accounts
          </CardTitle>
          <CardDescription>
            Configured SumUp merchant accounts for payment processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {merchantCodes.length > 0 ? (
            <div className="space-y-4">
              {merchantCodes.map((merchant) => (
                <div key={merchant.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{merchant.merchant_code}</h3>
                      <p className="text-sm text-muted-foreground">{merchant.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Created: {formatDate(merchant.created_at)}</span>
                        {merchant.last_sync_at && (
                          <span>• Last sync: {formatDate(merchant.last_sync_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={merchant.is_active ? 'default' : 'secondary'}>
                      {merchant.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge 
                      variant={
                        merchant.sync_status === 'active' ? 'default' :
                        merchant.sync_status === 'error' ? 'destructive' :
                        merchant.sync_status === 'syncing' ? 'secondary' : 'outline'
                      }
                    >
                      {merchant.sync_status}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No merchant accounts configured.</p>
              <p className="text-sm">Contact support to set up your SumUp integration.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Synchronization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Synchronization
          </CardTitle>
          <CardDescription>
            Sync payment transactions from SumUp to your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From Date</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To Date</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            
            <Button 
              onClick={handleSync} 
              disabled={isSyncing || merchantCodes.length === 0}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Sync Transactions
                </>
              )}
            </Button>

            {syncResult && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800">Sync Complete</h4>
                <p className="text-sm text-green-600">
                  {syncResult.message}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Real-time transaction updates via SumUp webhooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border rounded-lg">
              <h4 className="font-medium mb-2">Webhook URL</h4>
              <code className="text-sm bg-white p-2 rounded border block">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/sumup` : 'https://your-domain.com/api/webhooks/sumup'}
              </code>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Configure this URL in your SumUp merchant dashboard to receive real-time transaction updates.</p>
              <p className="mt-2">Events: <code>transaction.created</code>, <code>transaction.updated</code></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
