'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface VacationRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  days: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason: string | null
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  user?: {
    id: string
    name: string
    email: string
  }
  reviewed_by_user?: {
    id: string
    name: string
  }
}

interface VacationBalance {
  id: string
  user_id: string
  year: number
  total_days: number
  used_days: number
  remaining_days: number
  user?: {
    id: string
    name: string
    email: string
  }
}

interface UserData {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
}

export default function VacationPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [balance, setBalance] = useState<VacationBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null)
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  })
  const [reviewNotes, setReviewNotes] = useState('')

  useEffect(() => {
    fetchUserAndData()
  }, [])

  const fetchUserAndData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login' as any)
        return
      }

      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('auth_id', session.user.id)
        .single()

      if (userData) {
        setUser(userData as UserData)
        await fetchRequests(session.access_token, userData.id, userData.role)
        await fetchBalance(session.access_token, userData.id, userData.role)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRequests = async (token: string, userId: string, role: string) => {
    try {
      // Staff only see their own requests, managers/owners see all organization requests
      const url = role === 'staff' 
        ? '/api/vacation/requests'
        : '/api/vacation/requests'
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Error fetching vacation requests:', error)
    }
  }

  const fetchBalance = async (token: string, userId: string, role: string) => {
    try {
      const url = role === 'staff'
        ? `/api/vacation/balances?year=${new Date().getFullYear()}`
        : `/api/vacation/balances?user_id=${userId}&year=${new Date().getFullYear()}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setBalance(data.balances?.[0] || null)
      }
    } catch (error) {
      console.error('Error fetching vacation balance:', error)
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/vacation/requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setShowRequestDialog(false)
        setFormData({ start_date: '', end_date: '', reason: '' })
        await fetchUserAndData()
      } else {
        const error = await response.json()
        alert(error.error?.message || 'Fehler beim Erstellen der Anfrage')
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Fehler beim Erstellen der Anfrage')
    }
  }

  const handleReviewRequest = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/vacation/requests/${selectedRequest.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          review_notes: reviewNotes
        })
      })

      if (response.ok) {
        setShowReviewDialog(false)
        setSelectedRequest(null)
        setReviewNotes('')
        await fetchUserAndData()
      } else {
        const error = await response.json()
        alert(error.error?.message || 'Fehler beim Bearbeiten der Anfrage')
      }
    } catch (error) {
      console.error('Error reviewing request:', error)
      alert('Fehler beim Bearbeiten der Anfrage')
    }
  }

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Möchten Sie diese Anfrage wirklich stornieren?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/vacation/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'cancelled' })
      })

      if (response.ok) {
        await fetchUserAndData()
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Laden...</div>
      </div>
    )
  }

  const isManager = user?.role === 'owner' || user?.role === 'manager'
  const pendingRequests = requests.filter(r => r.status === 'pending')
  const myRequests = isManager ? requests : requests.filter(r => r.user_id === user?.id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Urlaub</h1>
                <p className="text-sm text-gray-600">Verwalten Sie Ihre Urlaubsanfragen</p>
              </div>
            </div>
            {user?.role !== 'owner' && user?.role !== 'manager' && (
              <button
                onClick={() => setShowRequestDialog(true)}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Neue Anfrage
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Vacation Balance Card */}
        {balance && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Urlaubskonto {balance.year}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Gesamt</div>
                <div className="text-2xl font-bold text-gray-900">{balance.total_days} Tage</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Genutzt</div>
                <div className="text-2xl font-bold text-orange-600">{balance.used_days} Tage</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Verbleibend</div>
                <div className="text-2xl font-bold text-green-600">{balance.remaining_days} Tage</div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Requests for Managers */}
        {isManager && pendingRequests.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ausstehende Anfragen</h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{request.user?.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {formatDate(request.start_date)} - {formatDate(request.end_date)} ({request.days} Tage)
                    </div>
                    {request.reason && (
                      <div className="text-sm text-gray-500 mt-1">{request.reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedRequest(request)
                        setShowReviewDialog(true)
                      }}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Bearbeiten
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isManager ? 'Alle Anfragen' : 'Meine Anfragen'}
          </h2>
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Keine Urlaubsanfragen vorhanden
              </div>
            ) : (
              myRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {isManager && (
                        <div className="font-medium text-gray-900 mb-1">{request.user?.name}</div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {formatDate(request.start_date)} - {formatDate(request.end_date)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">({request.days} Tage)</span>
                      </div>
                      {request.reason && (
                        <div className="text-sm text-gray-600 mb-2">{request.reason}</div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Angefragt: {formatDate(request.requested_at)}</span>
                        {request.reviewed_at && (
                          <span>
                            {request.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}: {formatDate(request.reviewed_at)}
                            {request.reviewed_by_user && ` von ${request.reviewed_by_user.name}`}
                          </span>
                        )}
                      </div>
                      {request.review_notes && (
                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <strong>Bemerkung:</strong> {request.review_notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        {request.status === 'pending' && 'Ausstehend'}
                        {request.status === 'approved' && 'Genehmigt'}
                        {request.status === 'rejected' && 'Abgelehnt'}
                        {request.status === 'cancelled' && 'Storniert'}
                      </span>
                      {request.status === 'pending' && !isManager && (
                        <button
                          onClick={() => handleCancelRequest(request.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Stornieren"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      {/* Request Dialog */}
      {showRequestDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Neue Urlaubsanfrage</h2>
            <form onSubmit={handleSubmitRequest}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Von
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bis
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grund (optional)
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRequestDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Anfrage stellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {showReviewDialog && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Anfrage bearbeiten</h2>
            <div className="mb-4">
              <div className="font-medium text-gray-900">{selectedRequest.user?.name}</div>
              <div className="text-sm text-gray-600">
                {formatDate(selectedRequest.start_date)} - {formatDate(selectedRequest.end_date)} ({selectedRequest.days} Tage)
              </div>
              {selectedRequest.reason && (
                <div className="text-sm text-gray-600 mt-2">{selectedRequest.reason}</div>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bemerkung (optional)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewDialog(false)
                  setSelectedRequest(null)
                  setReviewNotes('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleReviewRequest('rejected')}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Ablehnen
              </button>
              <button
                onClick={() => handleReviewRequest('approved')}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Genehmigen
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

