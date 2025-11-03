'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, LogIn, LogOut, CheckCircle, AlertCircle, ArrowLeft, Settings, LogOut as LogOutIcon, Coffee, Play } from 'lucide-react'

interface TimeClockEntry {
  id: string
  clock_in: string
  clock_out: string | null
  shift_id: string | null
  shift_start_time: string | null
  shift_end_time: string | null
  clock_in_deviation_minutes: number | null
  clock_out_deviation_minutes: number | null
  has_warning: boolean
  is_approved: boolean
  shift?: {
    id: string
    start_time: string
    end_time: string
    position: string | null
    status: string
  }
}

interface Shift {
  id: string
  user_id: string
  start_time: string
  end_time: string
  position: string | null
  status: string
}

interface Break {
  id: string
  break_start: string
  break_end: string | null
}

interface UserData {
  id: string
  name: string
  email: string
  role: string
}

export default function TimeClockPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UserData | null>(null)
  const [activeEntry, setActiveEntry] = useState<TimeClockEntry | null>(null)
  const [activeBreak, setActiveBreak] = useState<Break | null>(null)
  const [entries, setEntries] = useState<TimeClockEntry[]>([])
  const [nextShift, setNextShift] = useState<Shift | null>(null)
  const [isClocking, setIsClocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    fetchUser()
    checkActiveEntry()
    fetchEntries()
    fetchNextShift()
    checkActiveBreak()
  }, [])

  const fetchUser = async () => {
    try {
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

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (err) {
      console.error('Failed to fetch user:', err)
    }
  }

  useEffect(() => {
    // Check for active break whenever activeEntry changes
    if (activeEntry) {
      checkActiveBreak()
    } else {
      setActiveBreak(null)
    }
  }, [activeEntry])

  const checkActiveEntry = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/time-clock/entries', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch entries')
      }

      const data = await response.json()
      const active = data.entries?.find((e: TimeClockEntry) => !e.clock_out)
      setActiveEntry(active || null)
      
      if (active) {
        await checkActiveBreak()
      } else {
        setActiveBreak(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status')
    } finally {
      setIsLoading(false)
    }
  }

  const checkActiveBreak = async () => {
    try {
      if (!activeEntry) {
        setActiveBreak(null)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      const response = await fetch('/api/time-clock/break/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      setActiveBreak(data.break || null)
    } catch (err) {
      console.error('Failed to check active break:', err)
    }
  }

  const fetchEntries = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      const response = await fetch('/api/time-clock/entries', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch entries')
      }

      const data = await response.json()
      // Show last 20 entries
      setEntries((data.entries || []).slice(0, 20))
    } catch (err) {
      console.error('Failed to fetch entries:', err)
    }
  }

  const fetchNextShift = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      // Get current user to filter shifts
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        return
      }

      const userResponse = await fetch('/api/organizations/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!userResponse.ok) {
        return
      }

      const userData = await userResponse.json()
      const currentUserId = userData.user.id

      const now = new Date()
      // Fetch only shifts for the current user using user_id parameter
      const response = await fetch(`/api/shifts?start_date=${now.toISOString()}&user_id=${currentUserId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch shifts')
      }

      const data = await response.json()
      // Filter for upcoming shifts only (already filtered by user_id in API)
      const upcomingShifts = (data.shifts || [])
        .filter((shift: Shift) => {
          const startTime = new Date(shift.start_time)
          return startTime >= now && 
                 (shift.status === 'scheduled' || shift.status === 'confirmed')
        })
        .sort((a: Shift, b: Shift) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )

      if (upcomingShifts.length > 0) {
        setNextShift(upcomingShifts[0])
      }
    } catch (err) {
      console.error('Failed to fetch next shift:', err)
    }
  }

  const handleClockIn = async () => {
    try {
      setIsClocking(true)
      setError(null)
      setWarning(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/time-clock/clock-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to clock in')
      }

      if (data.warning) {
        setWarning(data.warning)
      }

      await checkActiveEntry()
      await fetchEntries()
      await checkActiveBreak()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clock in')
    } finally {
      setIsClocking(false)
    }
  }

  const handleClockOut = async () => {
    try {
      setIsClocking(true)
      setError(null)
      setWarning(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/time-clock/clock-out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to clock out')
      }

      if (data.warning) {
        setWarning(data.warning)
      }

      await checkActiveEntry()
      await fetchEntries()
      await checkActiveBreak()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clock out')
    } finally {
      setIsClocking(false)
    }
  }

  const handleBreakStart = async () => {
    try {
      setIsClocking(true)
      setError(null)
      setWarning(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/time-clock/break/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to start break')
      }

      await checkActiveBreak()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start break')
    } finally {
      setIsClocking(false)
    }
  }

  const handleBreakEnd = async () => {
    try {
      setIsClocking(true)
      setError(null)
      setWarning(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/time-clock/break/end', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to end break')
      }

      await checkActiveBreak()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end break')
    } finally {
      setIsClocking(false)
    }
  }

  const getTimeUntilNextShift = (shift: Shift) => {
    const now = new Date()
    const shiftStart = new Date(shift.start_time)
    const diffMs = shiftStart.getTime() - now.getTime()
    
    if (diffMs <= 0) return null

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    const parts = []
    if (days > 0) parts.push(`${days} Tag${days !== 1 ? 'e' : ''}`)
    if (hours > 0) parts.push(`${hours} Stunde${hours !== 1 ? 'n' : ''}`)
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} Minute${minutes !== 1 ? 'n' : ''}`)

    return parts.join(', ')
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatDate = (timeString: string) => {
    return new Date(timeString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Clock className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Laden...</span>
        </div>
      </div>
    )
  }

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
                <h1 className="text-2xl font-bold text-gray-900">Stempeluhr</h1>
                <p className="text-sm text-gray-600">Ein- und Ausstempeln</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">Logged in as</span>
                <span className="bg-gray-900 text-white px-2 py-1 rounded-full text-xs font-medium">
                  {user?.name} ({user?.role})
                </span>
              </div>
              
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
                <LogOutIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error/Warning Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {warning && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-yellow-800 text-sm font-medium">{warning}</p>
            </div>
          </div>
        )}

        {/* Active Shifts - Next Shift */}
        {nextShift && (
          <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Nächste Schicht</h2>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {nextShift.position ? (typeof nextShift.position === 'object' && nextShift.position !== null ? nextShift.position.name : nextShift.position) : 'Schicht'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(nextShift.start_time)} - {formatTime(nextShift.start_time)} bis {formatTime(nextShift.end_time)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-blue-600">
                    Startet in {getTimeUntilNextShift(nextShift)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clock In/Out Card */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden mb-8">
          <div className="px-6 py-8 text-center">
            <div className="mb-6">
              <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {activeEntry ? 'Eingestempelt' : 'Nicht eingestempelt'}
              </h2>
              {activeEntry && (
                <div className="mt-4 space-y-2">
                  <p className="text-gray-600">
                    Eingestempelt um: <span className="font-semibold">{formatTime(activeEntry.clock_in)}</span>
                  </p>
                  <p className="text-sm text-gray-500">{formatDate(activeEntry.clock_in)}</p>
                  {activeEntry.shift && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Geplante Schicht: {formatTime(activeEntry.shift.start_time)} - {formatTime(activeEntry.shift.end_time)}
                      </p>
                      {activeEntry.shift.position && (
                        <p className="text-xs text-blue-600 mt-1">Position: {typeof activeEntry.shift.position === 'object' && activeEntry.shift.position !== null ? activeEntry.shift.position.name : activeEntry.shift.position}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center space-y-4">
              {activeBreak && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <Coffee className="h-5 w-5 text-orange-600" />
                    <p className="text-orange-800 text-sm font-medium">
                      Pause aktiv seit {formatTime(activeBreak.break_start)}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center space-x-4">
                {!activeEntry ? (
                  <button
                    onClick={handleClockIn}
                    disabled={isClocking}
                    className="px-8 py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <LogIn className="h-5 w-5" />
                    <span>{isClocking ? 'Einstempeln...' : 'Einstempeln'}</span>
                  </button>
                ) : (
                  <>
                    {!activeBreak ? (
                      <button
                        onClick={handleBreakStart}
                        disabled={isClocking}
                        className="px-6 py-4 bg-orange-600 text-white rounded-xl font-semibold text-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        <Coffee className="h-5 w-5" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleBreakEnd}
                        disabled={isClocking}
                        className="px-6 py-4 bg-orange-600 text-white rounded-xl font-semibold text-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        <Play className="h-5 w-5" />
                        <span>Pause beenden</span>
                      </button>
                    )}
                    <button
                      onClick={handleClockOut}
                      disabled={isClocking || activeBreak !== null}
                      className="px-8 py-4 bg-red-600 text-white rounded-xl font-semibold text-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      title={activeBreak ? 'Bitte beenden Sie zuerst die Pause' : undefined}
                    >
                      <LogOut className="h-5 w-5" />
                      <span>{isClocking ? 'Ausstempeln...' : 'Ausstempeln'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Entries */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Gestempelte Zeiten</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {entries.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">Noch keine Einträge vorhanden</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${entry.clock_out ? 'bg-gray-400' : 'bg-green-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(entry.clock_in)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Eingestempelt: {formatTime(entry.clock_in)}
                            {entry.clock_out && ` • Ausgestempelt: ${formatTime(entry.clock_out)}`}
                          </p>
                        </div>
                      </div>
                      {entry.shift && (
                        <p className="text-xs text-gray-500 mt-1 ml-5">
                          Schicht: {entry.shift.position ? (typeof entry.shift.position === 'object' && entry.shift.position !== null ? entry.shift.position.name : entry.shift.position) : 'Schicht'} ({formatTime(entry.shift.start_time)} - {formatTime(entry.shift.end_time)})
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {entry.has_warning && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                          <AlertCircle className="h-3 w-3" />
                          <span>Abweichung</span>
                        </div>
                      )}
                      {entry.is_approved && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                          <CheckCircle className="h-3 w-3" />
                          <span>Bestätigt</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

