'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, MapPin, User } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'

interface Shift {
  id: string
  date: string
  start_time: string
  end_time: string
  position: string
  location?: string
  notes?: string
}

interface User {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createBrowserClient(
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
          <Button onClick={fetchUserAndShifts} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Shifts</h1>
          <p className="text-muted-foreground">
            View your upcoming and past shifts
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
          <LogoutButton />
        </div>
      </div>

      {/* Shifts List */}
      <div className="space-y-4">
        {shifts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No shifts scheduled</h3>
              <p className="text-gray-600">Check back later for your upcoming shifts.</p>
            </CardContent>
          </Card>
        ) : (
          shifts.map((shift) => {
            const shiftStatus = getShiftStatus(shift)
            return (
              <Card key={shift.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {shift.position}
                      </CardTitle>
                      <CardDescription>
                        {formatDate(shift.date)}
                      </CardDescription>
                    </div>
                    <Badge variant={shiftStatus.color === 'green' ? 'default' : 'secondary'}>
                      {shiftStatus.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        {shift.start_time} - {shift.end_time}
                      </span>
                    </div>
                    {shift.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{shift.location}</span>
                      </div>
                    )}
                  </div>
                  {shift.notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-700">{shift.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
