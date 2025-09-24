'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, Calendar, MapPin, ArrowLeft, Plus, Edit, Trash2, Settings, LogOut, Loader2 } from 'lucide-react'

interface Shift {
  id: string
  date: string
  start_time: string
  end_time: string
  position: string
  location?: string
  notes?: string
}

interface UserData {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    fetchUserAndShifts()
  }, [])

  const fetchUserAndShifts = async () => {
    try {
      setIsLoading(true)
      
      // Check if user is authenticated
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/login')
        return
      }

      // Get user profile
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/organizations/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }

      const data = await response.json()
      setUser(data.user)

      // For now, show mock shifts - in a real app, this would come from the API
      setShifts([
        {
          id: '1',
          date: '2024-01-23',
          start_time: '09:00',
          end_time: '17:00',
          position: 'Server',
          location: 'Main Dining Room',
          notes: 'Regular shift'
        },
        {
          id: '2',
          date: '2024-01-24',
          start_time: '18:00',
          end_time: '22:00',
          position: 'Server',
          location: 'Main Dining Room',
          notes: 'Evening shift'
        },
        {
          id: '3',
          date: '2024-01-25',
          start_time: '10:00',
          end_time: '18:00',
          position: 'Host',
          location: 'Reception',
          notes: 'Weekend shift'
        }
      ])
    } catch (error: any) {
      console.error('Failed to fetch shifts data:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getShiftStatus = (shift: Shift) => {
    const now = new Date()
    const shiftDate = new Date(`${shift.date} ${shift.start_time}`)
    const shiftEnd = new Date(`${shift.date} ${shift.end_time}`)
    
    if (now < shiftDate) {
      return { status: 'upcoming', color: 'blue' }
    } else if (now >= shiftDate && now <= shiftEnd) {
      return { status: 'current', color: 'green' }
    } else {
      return { status: 'completed', color: 'gray' }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading shifts...</span>
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
            onClick={fetchUserAndShifts}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Try Again
          </button>
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
                <h1 className="text-xl font-bold text-gray-900">Shift Management</h1>
                <p className="text-sm text-gray-600 mt-1">Manage staff schedules and shifts</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">Logged in as</span>
                    <span className="bg-gray-900 text-white px-2 py-1 rounded-full text-xs font-medium">
                      {user?.name} ({user?.role})
                    </span>
                  </div>
                  
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
                
                {(user?.role === 'manager' || user?.role === 'owner') && (
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="w-full bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{showCreateForm ? 'Cancel' : 'Add Shift'}</span>
                  </button>
                )}
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
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Logged in as</span>
                  <span className="bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-medium">
                    {user?.name} ({user?.role})
                  </span>
                </div>
                
                {(user?.role === 'manager' || user?.role === 'owner') && (
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{showCreateForm ? 'Cancel' : 'Add Shift'}</span>
                  </button>
                )}
                
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {user?.role === 'manager' || user?.role === 'owner' ? 'Shift Management' : 'My Shifts'}
          </h1>
          <p className="text-gray-600">
            {user?.role === 'manager' || user?.role === 'owner' 
              ? 'Manage and schedule employee shifts' 
              : 'View your upcoming and past shifts'
            }
          </p>
        </div>

        {/* Create Shift Form for Managers */}
        {(user?.role === 'manager' || user?.role === 'owner') && showCreateForm && (
          <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create New Shift</h2>
              <p className="text-sm text-gray-600">Schedule a new shift for an employee</p>
            </div>
            <div className="p-6">
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Shift creation form will be implemented here.</p>
                <p className="text-sm">This will include employee selection, date/time pickers, and position assignment.</p>
              </div>
            </div>
          </div>
        )}

        {/* Shifts List */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Shifts ({shifts.length})</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {shifts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No shifts scheduled</h3>
                <p className="text-gray-600">Check back later for your upcoming shifts.</p>
              </div>
            ) : (
              shifts.map((shift) => {
                const shiftStatus = getShiftStatus(shift)
                return (
                  <div key={shift.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-3">
                            <h3 className="text-sm font-medium text-gray-900">{shift.position}</h3>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              shiftStatus.color === 'green' ? 'bg-green-100 text-green-700' :
                              shiftStatus.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {shiftStatus.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{formatDate(shift.date)}</span>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {shift.start_time} - {shift.end_time}
                            </span>
                            {shift.location && (
                              <>
                                <span className="text-gray-300">•</span>
                                <MapPin className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">{shift.location}</span>
                              </>
                            )}
                          </div>
                          {shift.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-600">{shift.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {(user?.role === 'manager' || user?.role === 'owner') && (
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
