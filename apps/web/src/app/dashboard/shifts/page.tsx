'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, Calendar, ArrowLeft, Plus, Edit, Trash2, Settings, LogOut, Loader2, ChevronLeft, ChevronRight, Grid3x3, List, User, AlertCircle, CheckCircle, FileCheck, XCircle, Briefcase, Check, X, Save, FileText } from 'lucide-react'

interface Position {
  id: string
  organization_id: string
  name: string
  description: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Shift {
  id: string
  organization_id: string
  user_id: string | null // Nullable for open shifts
  start_time: string
  end_time: string
  position_id: string | null
  position: string | null // Legacy field
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  hourly_rate: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  user?: {
    id: string
    name: string
    email: string
  }
  position?: {
    id: string
    name: string
    color: string | null
  }
  created_by_user?: {
    id: string
    name: string
  }
  time_clock_entry?: Array<{
    id: string
    clock_in: string
    clock_out: string | null
    clock_in_deviation_minutes: number | null
    clock_out_deviation_minutes: number | null
    has_warning: boolean
    is_approved: boolean
  }>
}

interface UserData {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
}

interface OrganizationUser {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
  hourly_rate?: number | null
  position_id?: string | null
  position?: {
    id: string
    name: string
    color: string | null
  }
}

interface ShiftFormData {
  user_id: string // Empty string for open shifts
  start_time: string
  end_time: string
  position_id: string // Empty string for no position
  position: string // Legacy field
  notes: string
  status: 'scheduled' | 'confirmed'
}

interface ShiftTemplateItem {
  id?: string
  day_of_week: number // 0 = Sunday, 6 = Saturday
  start_time: string // HH:mm format
  end_time: string // HH:mm format
  user_id: string | null
  position_id: string | null
  notes: string | null
  status: 'scheduled' | 'confirmed'
  sort_order?: number
}

interface ShiftTemplate {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  shift_template_items?: ShiftTemplateItem[]
}

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
  user?: {
    id: string
    name: string
    email: string
  }
  shift?: {
    id: string
    start_time: string
    end_time: string
    position: string | null
  }
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]) // All position assignments
  const [user, setUser] = useState<UserData | null>(null)
  const [timeClockEntries, setTimeClockEntries] = useState<TimeClockEntry[]>([])
  const [vacationRequests, setVacationRequests] = useState<Array<{
    id: string
    user_id: string
    start_date: string
    end_date: string
    days: number
    status: string
    user?: { id: string; name: string; email: string }
  }>>([])
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeClockEntry | null>(null)
  const [showEditTimeEntryModal, setShowEditTimeEntryModal] = useState(false)
  const [approvalFilter, setApprovalFilter] = useState<'pending' | 'approved' | 'all'>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'approvals' | 'positions' | 'employees'>('calendar')
  const [leftColumnView, setLeftColumnView] = useState<'employees' | 'positions'>('employees')
  const [calendarSortMode, setCalendarSortMode] = useState<'name' | 'position'>('name')
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [_selectedDate, _setSelectedDate] = useState<Date | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date, hour: number } | null>(null)
  const [showShiftDialog, setShowShiftDialog] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPositionsModal, setShowPositionsModal] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [positionFormData, setPositionFormData] = useState({ name: '', description: '', color: '' })
  const [showEmployeePositionsModal, setShowEmployeePositionsModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<OrganizationUser | null>(null)
  const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(new Set())
  const [hoursSummaryMonth, setHoursSummaryMonth] = useState(new Date().getMonth() + 1) // 1-12
  const [hoursSummaryYear, setHoursSummaryYear] = useState(new Date().getFullYear())
  const [draggingShift, setDraggingShift] = useState<Shift | null>(null)
  const [_dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dropTarget, setDropTarget] = useState<{ date: Date, hour: number, minute: number } | null>(null)
  const [copyingShift, setCopyingShift] = useState<Shift | null>(null)
  const [formData, setFormData] = useState<ShiftFormData>({
    user_id: '', // Empty for open shifts
    start_time: '',
    end_time: '',
    position_id: '',
    position: '',
    notes: '',
    status: 'scheduled',
  })
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false)
  const [showApplyTemplateModal, setShowApplyTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    fetchUserAndShifts()
    // Expose handleAssignEmployeeToShift to window for inline onclick handlers
    ;(window as any).handleAssignToShift = (shiftId: string, userId: string) => {
      handleAssignEmployeeToShift(shiftId, userId)
    }
    // Expose handleAssignPosition to window for inline onclick handlers (legacy - single position)
    ;(window as any).handleAssignPosition = async (userId: string, positionId: string | null) => {
      await handleAssignPositionToUser(userId, positionId)
    }
    // Expose toggleUserPosition for multiple positions
    ;(window as any).toggleUserPosition = async (userId: string, positionId: string) => {
      await handleToggleUserPosition(userId, positionId)
    }
  }, [])

  // Reload vacation requests when week changes
  useEffect(() => {
    const fetchVacationRequests = async () => {
      if (!user) return
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const weekDays = getWeekDays(currentWeek)
      const weekStart = new Date(weekDays[0])
      weekStart.setDate(weekStart.getDate() - 7) // One week before
      const weekEnd = new Date(weekDays[6])
      weekEnd.setDate(weekEnd.getDate() + 7) // One week after
      
      const vacationResponse = await fetch(
        `/api/vacation/requests?status=approved&start_date=${weekStart.toISOString().split('T')[0]}&end_date=${weekEnd.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (vacationResponse.ok) {
        const vacationData = await vacationResponse.json()
        setVacationRequests(vacationData.requests || [])
      }
    }

    fetchVacationRequests()
  }, [currentWeek, user])

  // Close modals on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showShiftDialog || showEditModal) {
          setEditingShift(null)
          setShowCreateForm(false)
          setShowShiftDialog(false)
          setShowEditModal(false)
          setSelectedTimeSlot(null)
          setFormData({
            user_id: '',
            start_time: '',
            end_time: '',
            position_id: '',
            position: '',
            notes: '',
            status: 'scheduled'
          })
          setError(null)
        }
        if (showDeleteDialog) {
          setShowDeleteDialog(false)
          setShiftToDelete(null)
        }
        if (copyingShift) {
          setCopyingShift(null)
        }
        if (showPositionsModal) {
          setShowPositionsModal(false)
          setEditingPosition(null)
          setPositionFormData({ name: '', description: '', color: '' })
          setError(null)
        }
        if (showEmployeePositionsModal) {
          setShowEmployeePositionsModal(false)
          setEditingEmployee(null)
          setSelectedPositionIds(new Set())
          setError(null)
        }
        if (showCreateTemplateModal) {
          setShowCreateTemplateModal(false)
          setTemplateName('')
          setTemplateDescription('')
          setError(null)
        }
        if (showApplyTemplateModal) {
          setShowApplyTemplateModal(false)
          setSelectedTemplate(null)
          setError(null)
        }
        if (showEditTimeEntryModal) {
          setShowEditTimeEntryModal(false)
          setEditingTimeEntry(null)
          setError(null)
        }
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [
    showShiftDialog, 
    showEditModal, 
    showDeleteDialog, 
    copyingShift,
    showPositionsModal,
    showEmployeePositionsModal,
    showCreateTemplateModal,
    showApplyTemplateModal,
    showEditTimeEntryModal
  ])

  const fetchUserAndShifts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
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

      // Fetch user data
      const userResponse = await fetch('/api/organizations/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data')
      }

      const userData = await userResponse.json()
      setUser(userData.user)

      // Fetch shifts
      const shiftsResponse = await fetch('/api/shifts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!shiftsResponse.ok) {
        throw new Error('Failed to fetch shifts')
      }

      const shiftsData = await shiftsResponse.json()
      setShifts(shiftsData.shifts || [])

      // Fetch templates (only for managers and owners)
      if (userData.user.role === 'manager' || userData.user.role === 'owner') {
        await fetchTemplates(session.access_token)
      }

      // Fetch positions
      const positionsResponse = await fetch('/api/positions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json()
        setPositions(positionsData.positions || [])
      }

      // Fetch user positions (position assignments)
      const userPositionsResponse = await fetch('/api/user-positions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (userPositionsResponse.ok) {
        const userPositionsData = await userPositionsResponse.json()
        setUserPositions(userPositionsData.assignments || [])
      }

      // Fetch time clock entries for approvals view (manager/owner only)
      if (userData.user.role === 'manager' || userData.user.role === 'owner') {
        const entriesResponse = await fetch('/api/time-clock/entries', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (entriesResponse.ok) {
          const entriesData = await entriesResponse.json()
          setTimeClockEntries(entriesData.entries || [])
        }
      }

      // Fetch organization users
      if (userData.user.role === 'manager' || userData.user.role === 'owner') {
        // Managers and owners see all users
        const usersResponse = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setOrganizationUsers(usersData.users || [])
        }
      } else if (userData.user.role === 'staff') {
        // Staff users see all users in their organization (for viewing shifts)
        const usersResponse = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setOrganizationUsers(usersData.users || [])
        }
      }

      // Fetch approved vacation requests for calendar display
      const weekDays = getWeekDays(currentWeek)
      const weekStart = weekDays[0]
      const weekEnd = weekDays[6]
      const vacationResponse = await fetch(
        `/api/vacation/requests?status=approved&start_date=${weekStart.toISOString().split('T')[0]}&end_date=${weekEnd.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (vacationResponse.ok) {
        const vacationData = await vacationResponse.json()
        setVacationRequests(vacationData.requests || [])
      }
    } catch (error: any) {
      console.error('Failed to fetch shifts data:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const _formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getShiftStatus = (shift: Shift) => {
    const now = new Date()
    const startDate = new Date(shift.start_time)
    const endDate = new Date(shift.end_time)
    
    if (shift.status === 'cancelled') {
      return { status: 'cancelled', color: 'red' }
    }
    
    if (shift.status === 'completed') {
      return { status: 'completed', color: 'gray' }
    }
    
    if (now < startDate) {
      return { status: shift.status === 'confirmed' ? 'confirmed' : 'scheduled', color: 'blue' }
    } else if (now >= startDate && now <= endDate) {
      return { status: 'current', color: 'green' }
    } else {
      return { status: 'completed', color: 'gray' }
    }
  }

  // Calculate break time based on shift duration
  const calculateBreakTime = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0
    
    const start = new Date(startTime)
    const end = new Date(endTime)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    
    // More than 9 hours: 45 minutes break
    if (durationHours > 9) {
      return 45
    }
    // More than 6 hours: 30 minutes break
    if (durationHours > 6) {
      return 30
    }
    // Less than or equal to 6 hours: no break
    return 0
  }

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Calculate break time and adjust end_time
      const startTime = new Date(formData.start_time)
      const endTime = new Date(formData.end_time)
      const breakTimeMinutes = calculateBreakTime(formData.start_time, formData.end_time)
      const adjustedEndTime = new Date(endTime.getTime() + breakTimeMinutes * 60 * 1000)

      // Prepare data - user_id is optional (empty string = open shift)
      const shiftData = {
        user_id: formData.user_id || null, // null for open shifts
        start_time: startTime.toISOString(),
        end_time: adjustedEndTime.toISOString(),
        position_id: formData.position_id || null,
        position: formData.position || null, // Legacy field
        notes: formData.notes || null,
        status: formData.status
      }

      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shiftData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create shift')
      }

      // Reset form and refresh
      setFormData({
        user_id: '',
        start_time: '',
        end_time: '',
        position_id: '',
        position: '',
        notes: '',
        status: 'scheduled'
      })
      setShowCreateForm(false)
      setShowShiftDialog(false)
      setShowEditModal(false)
      setSelectedTimeSlot(null)
      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to create shift:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift)
    
    // Calculate original end time by subtracting break time
    // (since break time is automatically added when saving)
    const startTime = new Date(shift.start_time)
    const endTime = new Date(shift.end_time)
    const breakTimeMinutes = calculateBreakTime(shift.start_time, shift.end_time)
    const originalEndTime = new Date(endTime.getTime() - breakTimeMinutes * 60 * 1000)
    
    // Format datetime-local format (YYYY-MM-DDTHH:mm) in local timezone
    // Convert to local time by getting local date/time components
    const formatLocalDateTime = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
    
    const startDateTime = formatLocalDateTime(startTime)
    const endDateTime = formatLocalDateTime(originalEndTime)
    
    setFormData({
      user_id: shift.user_id || '', // Empty string for open shifts
      start_time: startDateTime,
      end_time: endDateTime,
      position_id: shift.position_id || '',
      position: shift.position || '',
      notes: shift.notes || '',
      status: shift.status === 'scheduled' || shift.status === 'confirmed' ? shift.status : 'scheduled',
    })
    setShowEditModal(true)
  }

  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingShift) return

    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Calculate break time and adjust end_time
      const startTime = new Date(formData.start_time)
      const endTime = new Date(formData.end_time)
      const breakTimeMinutes = calculateBreakTime(formData.start_time, formData.end_time)
      const adjustedEndTime = new Date(endTime.getTime() + breakTimeMinutes * 60 * 1000)

      // Prepare data
      const shiftData: any = {
        start_time: startTime.toISOString(),
        end_time: adjustedEndTime.toISOString(),
        position_id: formData.position_id || null,
        position: formData.position || null, // Legacy field
        notes: formData.notes || null,
        status: formData.status
      }

      // Only update user_id if it changed (allow setting to null for open shifts)
      if (formData.user_id !== (editingShift.user_id || '')) {
        shiftData.user_id = formData.user_id || null
      }

      const response = await fetch(`/api/shifts/${editingShift.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shiftData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update shift')
      }

      // Reset form and refresh
      setEditingShift(null)
      setFormData({
        user_id: '',
        start_time: '',
        end_time: '',
        position_id: '',
        position: '',
        notes: '',
        status: 'scheduled'
      })
      setShowCreateForm(false)
      setShowShiftDialog(false)
      setShowEditModal(false)
      setSelectedTimeSlot(null)
      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to update shift:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Fetch templates
  const fetchTemplates = async (token: string) => {
    try {
      const response = await fetch('/api/shift-templates', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error: any) {
      console.error('Failed to fetch templates:', error)
    }
  }

  // Create template from current week
  const handleCreateTemplateFromWeek = async () => {
    if (!templateName.trim()) {
      setError('Bitte geben Sie einen Namen für die Vorlage ein')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Get all shifts for the current week
      const weekDays = getWeekDays(currentWeek)
      const weekStart = new Date(weekDays[0])
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekDays[6])
      weekEnd.setHours(23, 59, 59, 999)

      const weekShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.start_time)
        return shiftDate >= weekStart && shiftDate <= weekEnd
      })

      if (weekShifts.length === 0) {
        setError('Keine Schichten in dieser Woche vorhanden')
        setIsSaving(false)
        return
      }

      // Convert shifts to template items
      const templateItems: ShiftTemplateItem[] = weekShifts.map((shift, index) => {
        const shiftStart = new Date(shift.start_time)
        const shiftEnd = new Date(shift.end_time)
        
        // Subtract break time to get original end time
        const breakTimeMinutes = calculateBreakTime(shift.start_time, shift.end_time)
        const originalEndTime = new Date(shiftEnd.getTime() - breakTimeMinutes * 60 * 1000)
        
        // Get day of week (0 = Monday, 6 = Sunday)
        let dayOfWeek = shiftStart.getDay()
        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Convert to Monday-based (0-6)

        // Extract time parts (HH:mm format)
        const startTimeStr = `${String(shiftStart.getHours()).padStart(2, '0')}:${String(shiftStart.getMinutes()).padStart(2, '0')}`
        const endTimeStr = `${String(originalEndTime.getHours()).padStart(2, '0')}:${String(originalEndTime.getMinutes()).padStart(2, '0')}`

        return {
          day_of_week: dayOfWeek,
          start_time: startTimeStr,
          end_time: endTimeStr,
          user_id: shift.user_id,
          position_id: shift.position_id,
          notes: shift.notes,
          status: shift.status === 'confirmed' ? 'confirmed' : 'scheduled',
          sort_order: index
        }
      })

      // Create template
      const response = await fetch('/api/shift-templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          items: templateItems
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        console.error('Template creation error:', errorData)
        throw new Error(errorData.error?.message || `Failed to create template (status: ${response.status})`)
      }

      const data = await response.json()
      
      // Refresh templates
      await fetchTemplates(session.access_token)
      
      // Reset form
      setTemplateName('')
      setTemplateDescription('')
      setShowCreateTemplateModal(false)
      
      // Show success message
      setError(null)
    } catch (error: any) {
      console.error('Failed to create template:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Apply template to a week
  const handleApplyTemplate = async (template: ShiftTemplate, targetWeekStart: Date) => {
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Format week start date as YYYY-MM-DD
      const weekStartStr = targetWeekStart.toISOString().split('T')[0]

      const response = await fetch('/api/shift-templates/apply', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: template.id,
          week_start_date: weekStartStr
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to apply template')
      }

      // Refresh shifts
      await fetchUserAndShifts()
      
      // Close modal
      setShowApplyTemplateModal(false)
      setSelectedTemplate(null)
      
      // Show success message
      setError(null)
    } catch (error: any) {
      console.error('Failed to apply template:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Möchten Sie diese Vorlage wirklich löschen?')) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/shift-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete template')
      }

      // Refresh templates
      await fetchTemplates(session.access_token)
    } catch (error: any) {
      console.error('Failed to delete template:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteShift = async () => {
    if (!shiftToDelete) return

    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/shifts/${shiftToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete shift')
      }

      // Reset and refresh
      setShiftToDelete(null)
      setShowDeleteDialog(false)
      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to delete shift:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelForm = () => {
    setEditingShift(null)
    setShowCreateForm(false)
    setShowShiftDialog(false)
    setShowEditModal(false)
    setSelectedTimeSlot(null)
    setCopyingShift(null)
    setFormData({
      user_id: '',
      start_time: '',
      end_time: '',
      position_id: '',
      position: '',
      notes: '',
      status: 'scheduled'
    })
    setError(null)
  }

  // Position Management Functions
  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: positionFormData.name.trim(),
          description: positionFormData.description.trim() || null,
          color: positionFormData.color || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create position')
      }

      setShowPositionsModal(false)
      setPositionFormData({ name: '', description: '', color: '' })
      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to create position:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePosition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPosition) return

    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/positions/${editingPosition.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: positionFormData.name.trim(),
          description: positionFormData.description.trim() || null,
          color: positionFormData.color || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update position')
      }

      setShowPositionsModal(false)
      setEditingPosition(null)
      setPositionFormData({ name: '', description: '', color: '' })
      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to update position:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePosition = async (positionId: string) => {
    if (!confirm('Möchten Sie diese Position wirklich löschen?')) return

    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete position')
      }

      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to delete position:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position)
    setPositionFormData({
      name: position.name,
      description: position.description || '',
      color: position.color || '',
    })
    setShowPositionsModal(true)
  }

  // Get shifts for open shifts (no user_id)
  const getOpenShiftsForDate = (date: Date): Shift[] => {
    return shifts.filter(shift => {
      if (shift.user_id !== null) return false // Only open shifts
      const shiftDate = new Date(shift.start_time)
      return shiftDate.getFullYear() === date.getFullYear() &&
             shiftDate.getMonth() === date.getMonth() &&
             shiftDate.getDate() === date.getDate()
    })
  }

  // Assign position to employee - opens modal
  const handleAssignPositionToEmployee = (employee: OrganizationUser) => {
    // Get current positions for this employee
    const currentPositions = userPositions.filter(up => up.user_id === employee.id)
    const currentPositionIds = new Set(currentPositions.map(up => up.position_id))
    
    setEditingEmployee(employee)
    setSelectedPositionIds(currentPositionIds)
    setShowEmployeePositionsModal(true)
  }

  // Handle position checkbox toggle
  const handlePositionToggle = (positionId: string) => {
    setSelectedPositionIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(positionId)) {
        newSet.delete(positionId)
      } else {
        newSet.add(positionId)
      }
      return newSet
    })
  }

  // Save employee positions
  const handleSaveEmployeePositions = async () => {
    if (!editingEmployee) return

    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Get current positions
      const currentPositions = userPositions.filter(up => up.user_id === editingEmployee.id)
      const currentPositionIds = new Set(currentPositions.map(up => up.position_id))

      // Determine positions to add and remove
      const positionsToAdd = Array.from(selectedPositionIds).filter(id => !currentPositionIds.has(id))
      const positionsToRemove = Array.from(currentPositionIds).filter(id => !selectedPositionIds.has(id))

      // Remove positions
      for (const positionId of positionsToRemove) {
        const response = await fetch(`/api/user-positions?user_id=${editingEmployee.id}&position_id=${positionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          if (!errorData.error?.message?.includes('not found')) {
            throw new Error(errorData.error?.message || 'Failed to remove position')
          }
        }
      }

      // Add positions
      for (const positionId of positionsToAdd) {
        const response = await fetch('/api/user-positions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: editingEmployee.id, position_id: positionId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          // Ignore if already assigned
          if (!errorData.error?.message?.includes('already assigned') && 
              !errorData.error?.message?.includes('already exists') &&
              !errorData.error?.message?.includes('unique constraint')) {
            throw new Error(errorData.error?.message || 'Failed to assign position')
          }
        }
      }

      // Refresh data
      await fetchUserAndShifts()
      
      // Close modal
      setShowEmployeePositionsModal(false)
      setEditingEmployee(null)
      setSelectedPositionIds(new Set())
    } catch (error: any) {
      console.error('Failed to save employee positions:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle user position (add if not exists, remove if exists)
  const handleToggleUserPosition = async (userId: string, positionId: string) => {
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Check if assignment already exists
      const existingAssignment = userPositions.find(up => up.user_id === userId && up.position_id === positionId)
      
      if (existingAssignment) {
        // Remove assignment
        const response = await fetch(`/api/user-positions?user_id=${userId}&position_id=${positionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Failed to remove position assignment')
        }
      } else {
        // Add assignment
        const response = await fetch('/api/user-positions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId, position_id: positionId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          // If position is already assigned, treat it as success (idempotent operation)
          if (errorData.error?.message?.includes('already assigned') || 
              errorData.error?.message?.includes('already exists') ||
              errorData.error?.message?.includes('unique constraint')) {
            // Position is already assigned, which is fine - just refresh the data
            console.log('Position already assigned, refreshing data...')
          } else {
            throw new Error(errorData.error?.message || 'Failed to assign position')
          }
        }
      }

      // Close any open menus safely
      const menus = document.querySelectorAll('[class*="fixed bg-white rounded-lg shadow-xl"]')
      menus.forEach(menu => {
        if (menu.parentNode === document.body) {
          try {
            document.body.removeChild(menu)
          } catch (error) {
            // Menu was already removed, ignore
          }
        }
      })

      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to toggle user position:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Assign position to user (legacy - single position)
  const handleAssignPositionToUser = async (userId: string, positionId: string | null) => {
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ position_id: positionId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to assign position')
      }

      // Close any open menus
      const menus = document.querySelectorAll('[class*="fixed bg-white rounded-lg shadow-xl"]')
      menus.forEach(menu => {
        if (menu.parentElement === document.body) {
          document.body.removeChild(menu)
        }
      })

      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to assign position:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Assign employee to open shift
  const handleAssignEmployeeToShift = async (shiftId: string, userId: string) => {
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to assign employee')
      }

      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to assign employee:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyShift = (shift: Shift, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setCopyingShift(shift)
    setShowEditModal(false)
  }

  const handlePasteShift = async (targetDate: Date, targetUserId?: string) => {
    if (!copyingShift) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const originalStart = new Date(copyingShift.start_time)
      const originalEnd = new Date(copyingShift.end_time)
      const duration = originalEnd.getTime() - originalStart.getTime()

      // Use the same time (hours and minutes) as the original shift
      const newStart = new Date(targetDate)
      newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)

      // Calculate new end time (same duration)
      const newEnd = new Date(newStart.getTime() + duration)

      // For open shifts (user_id === null), keep as open shift even if targetUserId is provided
      // For assigned shifts, use targetUserId if provided, otherwise keep original
      const shiftData = {
        user_id: copyingShift.user_id === null 
          ? null  // Keep as open shift if original was open
          : (targetUserId || copyingShift.user_id || null), // Otherwise use target or original
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        position_id: copyingShift.position_id || null,
        position: copyingShift.position || null, // Legacy field
        notes: copyingShift.notes || null,
        status: copyingShift.status
      }

      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shiftData),
      })

      if (!response.ok) {
        throw new Error('Failed to copy shift')
      }

      setCopyingShift(null)
      await fetchUserAndShifts()
    } catch (error: any) {
      console.error('Failed to copy shift:', error)
      setError(error.message)
    }
  }

  // Calendar helper functions
  const getWeekDays = (date: Date): Date[] => {
    const week: Date[] = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
    startOfWeek.setDate(diff)
    
    for (let i = 0; i < 7; i++) {
      const newDate = new Date(startOfWeek)
      newDate.setDate(startOfWeek.getDate() + i)
      week.push(newDate)
    }
    return week
  }

  const _getShiftsForDateAndHour = (date: Date, hour: number): Shift[] => {
    return shifts.filter(shift => {
      const shiftStart = new Date(shift.start_time)
      const shiftDate = new Date(shiftStart.getFullYear(), shiftStart.getMonth(), shiftStart.getDate())
      const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      
      return shiftDate.getTime() === targetDate.getTime() && shiftStart.getHours() === hour
    })
  }

  const getShiftsForDate = (date: Date): Shift[] => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.start_time)
      return shiftDate.getFullYear() === date.getFullYear() &&
             shiftDate.getMonth() === date.getMonth() &&
             shiftDate.getDate() === date.getDate()
    })
  }

  const getVacationForDate = (date: Date): Array<{
    id: string
    user_id: string
    start_date: string
    end_date: string
    days: number
    user?: { id: string; name: string; email: string }
  }> => {
    const dateStr = date.toISOString().split('T')[0]
    return vacationRequests.filter(vr => {
      const startDate = new Date(vr.start_date)
      const endDate = new Date(vr.end_date)
      const checkDate = new Date(dateStr)
      return checkDate >= startDate && checkDate <= endDate
    })
  }

  const _handleTimeSlotClick = (date: Date, hour: number, minutes: number = 0) => {
    if (user?.role !== 'manager' && user?.role !== 'owner') return
    
    setSelectedTimeSlot({ date, hour })
    
    // Set default times - start at the selected quarter hour
    const startDateTime = new Date(date)
    startDateTime.setHours(hour, minutes, 0, 0)
    const endDateTime = new Date(date)
    endDateTime.setHours(hour, minutes, 0, 0)
    endDateTime.setHours(endDateTime.getHours() + 4) // Default 4-hour shift
    
    setFormData({
      user_id: '', // Empty for open shift
      start_time: startDateTime.toISOString().slice(0, 16),
      end_time: endDateTime.toISOString().slice(0, 16),
      position_id: '',
      position: '',
      notes: '',
      status: 'scheduled'
    })
    
    setShowShiftDialog(true)
    setShowCreateForm(true)
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeek)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentWeek(newDate)
  }

  const goToToday = () => {
    setCurrentWeek(new Date())
  }

  const handleApproveTimeEntry = async (entryId: string) => {
    try {
      setIsSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/time-clock/approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entryId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to approve entry')
      }

      // Remove from selected entries
      const newSelected = new Set(selectedEntries)
      newSelected.delete(entryId)
      setSelectedEntries(newSelected)

      await fetchUserAndShifts()
      
      // Refresh time clock entries
      if (session) {
        const entriesResponse = await fetch('/api/time-clock/entries', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (entriesResponse.ok) {
          const entriesData = await entriesResponse.json()
          setTimeClockEntries(entriesData.entries || [])
        }
      }
    } catch (error: any) {
      console.error('Failed to approve time entry:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleBulkApprove = async () => {
    if (selectedEntries.size === 0) return

    try {
      setIsSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/time-clock/approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entryIds: Array.from(selectedEntries) }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to approve entries')
      }

      setSelectedEntries(new Set())
      await fetchUserAndShifts()
      
      // Refresh time clock entries
      const entriesResponse = await fetch('/api/time-clock/entries', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json()
        setTimeClockEntries(entriesData.entries || [])
      }
    } catch (error: any) {
      console.error('Failed to approve entries:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRejectTimeEntry = async (entryId: string) => {
    if (!confirm('Möchten Sie diesen Eintrag wirklich ablehnen? Er wird gelöscht.')) {
      return
    }

    try {
      setIsSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/time-clock/reject', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entryId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to reject entry')
      }

      // Remove from selected entries
      const newSelected = new Set(selectedEntries)
      newSelected.delete(entryId)
      setSelectedEntries(newSelected)

      await fetchUserAndShifts()
      
      // Refresh time clock entries
      const entriesResponse = await fetch('/api/time-clock/entries', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json()
        setTimeClockEntries(entriesData.entries || [])
      }
    } catch (error: any) {
      console.error('Failed to reject time entry:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateTimeEntry = async (formData: { clock_in: string; clock_out?: string }) => {
    if (!editingTimeEntry) return

    try {
      setIsSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/time-clock/update', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entryId: editingTimeEntry.id,
          clock_in: formData.clock_in,
          clock_out: formData.clock_out || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update entry')
      }

      setShowEditTimeEntryModal(false)
      setEditingTimeEntry(null)
      await fetchUserAndShifts()
      
      // Refresh time clock entries
      const entriesResponse = await fetch('/api/time-clock/entries', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json()
        setTimeClockEntries(entriesData.entries || [])
      }
    } catch (error: any) {
      console.error('Failed to update time entry:', error)
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate employee stats for current week
  const getEmployeeStats = (userId: string) => {
    const weekDays = getWeekDays(currentWeek)
    const weekStart = new Date(weekDays[0])
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekDays[6])
    weekEnd.setHours(23, 59, 59, 999)
    
    const employeeShifts = shifts.filter(s => {
      if (s.user_id !== userId) return false
      const shiftDate = new Date(s.start_time)
      return shiftDate >= weekStart && shiftDate <= weekEnd
    })
    const totalMinutes = employeeShifts.reduce((sum, shift) => {
      const start = new Date(shift.start_time)
      const end = new Date(shift.end_time)
      const duration = (end.getTime() - start.getTime()) / (1000 * 60)
      return sum + duration
    }, 0)
    
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const shiftCount = employeeShifts.length
    
    // Calculate cost if hourly_rate is available
    const employee = organizationUsers.find(u => u.id === userId)
    const totalCost = employee?.hourly_rate ? (totalMinutes / 60) * employee.hourly_rate : 0
    
    return {
      hours,
      minutes,
      shiftCount,
      totalCost
    }
  }

  // Get initials from name
  // Render multi-position avatar with proportional colors
  const renderMultiPositionAvatar = (_positions: Position[], initials: string, size: number = 32) => {
    // Always use gray background for employee avatars
    return (
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs"
        style={{ backgroundColor: '#6b7280', width: `${size}px`, height: `${size}px` }}
      >
        {initials}
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Get shifts for employee and date
  const getShiftsForEmployeeAndDate = (userId: string, date: Date): Shift[] => {
    return shifts.filter(shift => {
      if (shift.user_id !== userId) return false
      const shiftDate = new Date(shift.start_time)
      return shiftDate.getFullYear() === date.getFullYear() &&
             shiftDate.getMonth() === date.getMonth() &&
             shiftDate.getDate() === date.getDate()
    })
  }

  // Get time range for the day (min start, max end)
  const getDayTimeRange = () => {
    // Show 6:00 - 24:00 by default
    return { start: 6, end: 24 }
  }

  // Drag & Drop handlers
  const handleShiftDragStart = (e: React.DragEvent, shift: Shift) => {
    if (user?.role !== 'manager' && user?.role !== 'owner') return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', shift.id)
    setDraggingShift(shift)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleShiftDragEnd = async () => {
    if (draggingShift && dropTarget) {
      const newStartTime = new Date(dropTarget.date)
      newStartTime.setHours(dropTarget.hour, dropTarget.minute, 0, 0)
      
      const oldStartTime = new Date(draggingShift.start_time)
      const oldEndTime = new Date(draggingShift.end_time)
      const duration = oldEndTime.getTime() - oldStartTime.getTime()
      
      const newEndTime = new Date(newStartTime.getTime() + duration)
      
      // Update shift
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const shiftData = {
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString()
        }

        const response = await fetch(`/api/shifts/${draggingShift.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(shiftData),
        })

        if (response.ok) {
          await fetchUserAndShifts()
        }
      } catch (error) {
        console.error('Failed to update shift time:', error)
      }
    }
    setDraggingShift(null)
    setDropTarget(null)
    setDragOffset({ x: 0, y: 0 })
  }


  const handleTimeSlotDrop = (e: React.DragEvent, date: Date, hour?: number, minute?: number) => {
    e.preventDefault()
    if (draggingShift) {
      // If hour/minute not provided, calculate from mouse position
      let dropHour = hour
      let dropMinute = minute || 0
      
      if (hour === undefined || minute === undefined) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const y = e.clientY - rect.top
        const timeRange = getDayTimeRange()
        const totalMinutes = ((y / 100) * (timeRange.end - timeRange.start) * 60)
        dropHour = Math.floor(totalMinutes / 60) + timeRange.start
        dropMinute = Math.floor((totalMinutes % 60) / 15) * 15
      }
      
      setDropTarget({ date, hour: dropHour, minute: dropMinute })
      // We'll handle the update in dragEnd
    }
  }

  const handleTimeSlotDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const _calculateTimeFromPosition = (_date: Date, y: number): { hour: number, minute: number } => {
    // Each hour is 80px tall, so calculate which hour and minute
    const hourHeight = 80
    const totalMinutes = Math.floor((y / hourHeight) * 60)
    const hour = Math.floor(totalMinutes / 60)
    const minute = Math.floor((totalMinutes % 60) / 15) * 15 // Snap to 15-minute intervals
    return { hour: Math.max(0, Math.min(23, hour)), minute: Math.max(0, Math.min(45, minute)) }
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
        <div className="mb-6 flex items-center justify-between">
          <div>
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
          
          {/* View Toggle */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                viewMode === 'calendar' 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3x3 className="h-4 w-4" />
              <span>Kalender</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                viewMode === 'list' 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
              <span>Liste</span>
            </button>
            {(user?.role === 'manager' || user?.role === 'owner') && (
              <button
                onClick={() => setViewMode('approvals')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                  viewMode === 'approvals' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileCheck className="h-4 w-4" />
                <span>Bestätigungen</span>
              </button>
            )}
          </div>
        </div>

        {/* Create/Edit Shift Form for Managers - Modal when from calendar, inline when from list */}
        {(user?.role === 'manager' || user?.role === 'owner') && showCreateForm && (
          <>
            {/* Modal Backdrop - Only show when opened from calendar */}
            {showShiftDialog && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={handleCancelForm}
              />
            )}
            
            {/* Form Container - Modal when from calendar, Card when from list */}
            <div className={`${
              showShiftDialog 
                ? 'fixed inset-0 z-50 flex items-center justify-center p-4' 
                : 'mb-8'
            }`}>
              <div 
                className={`bg-white rounded-2xl flat-shadow-lg overflow-hidden ${
                  showShiftDialog 
                    ? 'w-full max-w-2xl max-h-[90vh] overflow-y-auto' 
                    : 'w-full'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingShift ? 'Schicht bearbeiten' : selectedTimeSlot ? 'Neue Schicht erstellen' : 'Neue Schicht erstellen'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {editingShift 
                      ? 'Schicht-Details aktualisieren' 
                      : selectedTimeSlot 
                        ? (() => {
                            const slotDate = new Date(selectedTimeSlot.date)
                            // Find the selected time from formData to show accurate time
                            const formStartTime = formData.start_time ? new Date(formData.start_time) : null
                            const displayHour = formStartTime ? formStartTime.getHours() : selectedTimeSlot.hour
                            const displayMinutes = formStartTime ? formStartTime.getMinutes() : 0
                            return `Schicht erstellen für ${slotDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} um ${String(displayHour).padStart(2, '0')}:${String(displayMinutes).padStart(2, '0')}`
                          })()
                        : 'Planen Sie eine neue Schicht für einen Mitarbeiter'
                    }
                  </p>
                </div>
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <form onSubmit={editingShift ? handleUpdateShift : handleCreateShift} className="space-y-4">
                {/* Position Selection */}
                <div>
                  <label htmlFor="position_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Position <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="position_id"
                    required
                    value={formData.position_id}
                    onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  >
                    <option value="">Position auswählen</option>
                    {positions.filter(p => p.is_active).map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                  {(user?.role === 'manager' || user?.role === 'owner') && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPosition(null)
                        setPositionFormData({ name: '', description: '', color: '' })
                        setShowPositionsModal(true)
                      }}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                    >
                      Positionen verwalten
                    </button>
                  )}
                </div>

                {/* Employee Selection - Optional for open shifts */}
                <div>
                  <label htmlFor="user_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Mitarbeiter
                    <span className="text-xs text-gray-500 ml-1">(Optional - leer lassen für offene Schicht)</span>
                  </label>
                  <select
                    id="user_id"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  >
                    <option value="">Offene Schicht (kein Mitarbeiter)</option>
                    {organizationUsers.filter(u => u.role !== 'owner').map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email}) - {user.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Time */}
                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                    Startzeit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="start_time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                {/* End Time */}
                <div>
                  <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                    Endzeit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="end_time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>



                {/* Status */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'scheduled' | 'confirmed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  >
                    <option value="scheduled">Geplant</option>
                    <option value="confirmed">Bestätigt</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Zusätzliche Notizen oder Anweisungen..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{editingShift ? 'Schicht aktualisieren' : 'Schicht erstellen'}</span>
                  </button>
                </div>
              </form>
            </div>
              </div>
            </div>
          </>
        )}

        {/* Matrix Calendar View */}
        {viewMode === 'calendar' && (
          <div className="flex gap-6">
            {/* Left Column - Employee List */}
            <div className="w-80 bg-white rounded-2xl flat-shadow-lg overflow-hidden flex-shrink-0">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center space-x-2 mb-3">
                  <button 
                    onClick={() => setLeftColumnView('employees')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      leftColumnView === 'employees' 
                        ? 'text-gray-900 bg-gray-100' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Mitarbeiter
                  </button>
                  <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg">
                    Gruppen
                  </button>
                  <button 
                    onClick={() => {
                      if (user?.role === 'manager' || user?.role === 'owner') {
                        setLeftColumnView('positions')
                      }
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      leftColumnView === 'positions' 
                        ? 'text-gray-900 bg-gray-100' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Positionen
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {leftColumnView === 'employees' ? 'Mitarbeiter verwalten' : 'Positionen verwalten'}
                </h3>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Sortieren nach</span>
                  <select className="text-xs border border-gray-200 rounded px-2 py-1">
                    <option>Name</option>
                  </select>
                </div>
              </div>

              {/* Content based on selected tab */}
              {leftColumnView === 'employees' ? (
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  {/* Open Shifts */}
                  {(() => {
                    // Calculate open shifts for current week
                    const weekDays = getWeekDays(currentWeek)
                    const weekStart = new Date(weekDays[0])
                    weekStart.setHours(0, 0, 0, 0)
                    const weekEnd = new Date(weekDays[6])
                    weekEnd.setHours(23, 59, 59, 999)
                    
                    const openShiftsCount = shifts.filter(s => {
                      if (s.user_id !== null) return false // Only open shifts
                      const shiftDate = new Date(s.start_time)
                      return shiftDate >= weekStart && shiftDate <= weekEnd
                    }).length
                    
                    return (
                      <div className="px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">Offene Schicht</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {openShiftsCount} Schicht{openShiftsCount !== 1 ? 'en' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Employees */}
                  {organizationUsers
                    .filter(u => u.role !== 'owner')
                    .filter(u => {
                      // Staff users only see themselves in the employee list
                      if (user?.role === 'staff') {
                        return u.id === user?.id
                      }
                      return true
                    })
                    .map((employee) => {
                    const stats = getEmployeeStats(employee.id)
                    // Get all positions for this employee from user_positions
                    const employeePositions = userPositions
                      .filter(up => up.user_id === employee.id && up.position)
                      .map(up => up.position)
                      .filter((p): p is Position => p !== null && p !== undefined)
                    // Fallback to legacy position_id if no user_positions exist
                    const legacyPosition = employee.position_id ? positions.find(p => p.id === employee.position_id) : null
                    const allPositions = employeePositions.length > 0 
                      ? employeePositions
                      : (legacyPosition ? [legacyPosition] : [])
                    
                    return (
                      <div 
                        key={employee.id} 
                        className="px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {renderMultiPositionAvatar(allPositions, getInitials(employee.name), 40)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                              {(user?.role === 'manager' || user?.role === 'owner') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAssignPositionToEmployee(employee)
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                                  title="Positionen zuordnen"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {allPositions.length > 0 ? (
                                allPositions.map((pos) => (
                                  pos && (
                                    <span 
                                      key={pos.id}
                                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                                      style={{ 
                                        backgroundColor: (pos.color || '#3b82f6') + '20',
                                        color: pos.color || '#3b82f6'
                                      }}
                                    >
                                      {pos.name}
                                    </span>
                                  )
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">Keine Position</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {stats.hours}Std {stats.minutes}Min / {stats.totalCost.toFixed(2)} € / {stats.shiftCount} Schichten
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Add Employee Button */}
                  {(user?.role === 'manager' || user?.role === 'owner') && (
                    <div className="px-4 py-4 border-t border-gray-200">
                      <button
                        onClick={() => {
                          // Navigate to user management
                          router.push('/dashboard/users')
                        }}
                        className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium flex items-center justify-center space-x-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Mitarbeiter erstellen</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : leftColumnView === 'positions' && (user?.role === 'manager' || user?.role === 'owner') ? (
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  {/* Positions List */}
                  {positions.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-gray-500">Noch keine Positionen erstellt</p>
                    </div>
                  ) : (
                    positions.map((position) => (
                      <div
                        key={position.id}
                        className="px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm"
                            style={{ backgroundColor: position.color || '#3b82f6' }}
                          >
                            {position.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-gray-900">{position.name}</div>
                              <div className="flex items-center space-x-2">
                                {!position.is_active && (
                                  <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded">
                                    Inaktiv
                                  </span>
                                )}
                                <button
                                  onClick={() => handleEditPosition(position)}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                                  title="Position bearbeiten"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDeletePosition(position.id)}
                                  disabled={isSaving}
                                  className="p-1 text-red-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                                  title="Position löschen"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            {position.description && (
                              <div className="text-xs text-gray-500 mt-0.5">{position.description}</div>
                            )}
                            {/* Show count of users with this position */}
                            <div className="text-xs text-gray-400 mt-0.5">
                              {userPositions.filter(up => up.position_id === position.id).length} Mitarbeiter
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add Position Button */}
                  <div className="px-4 py-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setEditingPosition(null)
                        setPositionFormData({ name: '', description: '', color: '' })
                        setShowPositionsModal(true)
                      }}
                      className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium flex items-center justify-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Position erstellen</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Right Column - Matrix View */}
            <div className="flex-1 bg-white rounded-2xl flat-shadow-lg overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => navigateWeek('prev')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                      {getWeekDays(currentWeek)[0].toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button
                      onClick={() => navigateWeek('next')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setCalendarSortMode('name')}
                        className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                          calendarSortMode === 'name'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Nach Namen
                      </button>
                      <button
                        onClick={() => setCalendarSortMode('position')}
                        className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                          calendarSortMode === 'position'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Nach Positionen
                      </button>
                    </div>
                    <Link href="/dashboard/time-clock">
                      <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>Stempeluhr</span>
                      </button>
                    </Link>
                    {copyingShift && (
                      <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium flex items-center space-x-2">
                        <Plus className="h-4 w-4" />
                        <span>Kopier-Modus: Klicke auf einen Tag, um die Schicht einzufügen</span>
                        <button
                          onClick={() => setCopyingShift(null)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <button
                      onClick={goToToday}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Heute
                    </button>
                    {(user?.role === 'manager' || user?.role === 'owner') && (
                      <>
                        <button
                          onClick={() => setShowCreateTemplateModal(true)}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                          title="Vorlage aus aktueller Woche erstellen"
                        >
                          <Save className="h-4 w-4" />
                          <span>Als Vorlage speichern</span>
                        </button>
                        <button
                          onClick={() => setShowApplyTemplateModal(true)}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                          title="Vorlage auf diese Woche anwenden"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Vorlage anwenden</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Matrix Grid */}
              <div className="overflow-auto">
                <div className="min-w-[800px]">
                  {/* Days Header */}
                  <div className="grid grid-cols-8 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div className="p-3 border-r border-gray-200 bg-gray-50"></div>
                    {getWeekDays(currentWeek).map((date, index) => {
                      const isToday = date.toDateString() === new Date().toDateString()
                      const shiftsForDay = getShiftsForDate(date)
                      return (
                        <div
                          key={index}
                          className={`p-3 text-center border-r border-gray-200 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}
                        >
                          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                            {date.toLocaleDateString('de-DE', { weekday: 'short' })}
                          </div>
                          <div className={`text-lg font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                            {date.getDate()}
                          </div>
                          <div className="text-xs text-gray-500">• {shiftsForDay.length} Schicht{shiftsForDay.length !== 1 ? 'en' : ''}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Employee Rows × Day Columns */}
                  {(() => {
                    if (calendarSortMode === 'position') {
                      // Group by shift positions: show positions in Y-axis based on shift.position_id, employees shown in shift cards
                      const shiftsByPosition = new Map<string | null, Shift[]>()
                      
                      // Group all shifts by their position_id (the position of the shift, not the employee)
                      shifts.forEach(shift => {
                        // Get position_id from shift - prefer position_id field, then check position object
                        let positionId: string | null = null
                        if (shift.position_id) {
                          positionId = shift.position_id
                        } else if (shift.position && typeof shift.position === 'object' && shift.position !== null) {
                          const posObj = shift.position as { id?: string }
                          if (posObj && 'id' in posObj && posObj.id) {
                            positionId = posObj.id
                          }
                        }
                        if (!shiftsByPosition.has(positionId)) {
                          shiftsByPosition.set(positionId, [])
                        }
                        shiftsByPosition.get(positionId)!.push(shift)
                      })
                      
                      // Get all unique positions from shifts
                      const positionIds = Array.from(shiftsByPosition.keys()).filter(id => id !== null)
                      const sortedPositions: Array<{ position: Position | null, positionId: string | null, shifts: Shift[] }> = []
                      
                      // For each position, get the position object and sort
                      positionIds.forEach(positionId => {
                        const position = positions.find(p => p.id === positionId) || null
                        const positionShifts = shiftsByPosition.get(positionId) || []
                        sortedPositions.push({ position, positionId, shifts: positionShifts })
                      })
                      
                      // Also include shifts without position (null position)
                      const nullPositionShifts = shiftsByPosition.get(null) || []
                      if (nullPositionShifts.length > 0) {
                        sortedPositions.push({ position: null, positionId: null, shifts: nullPositionShifts })
                      }
                      
                      // Sort positions by name (null last)
                      sortedPositions.sort((a, b) => {
                        if (a.position === null && b.position === null) return 0
                        if (a.position === null) return 1
                        if (b.position === null) return -1
                        return a.position.name.localeCompare(b.position.name)
                      })
                      
                      // Calculate total height: number of positions with shifts + 1 for open shifts row
                      // Only count positions that actually have shifts in the displayed week
                      const weekDays = getWeekDays(currentWeek)
                      const weekStartDate = weekDays[0]
                      const weekEndDate = weekDays[weekDays.length - 1]
                      weekEndDate.setHours(23, 59, 59, 999) // End of last day
                      
                      const positionsWithShiftsInWeek = sortedPositions.filter(({ shifts: positionShifts }) => {
                        // Check if any shift is in the displayed week
                        return positionShifts.some(shift => {
                          const shiftDate = new Date(shift.start_time)
                          return shiftDate >= weekStartDate && shiftDate <= weekEndDate
                        })
                      })
                      
                      const totalRows = positionsWithShiftsInWeek.length + 1 // +1 for open shifts row
                      const containerHeight = totalRows * 100
                      
                      return (
                        <div key="position-mode" className="relative" style={{ height: `${containerHeight}px` }}>
                          {/* Position Rows - only show positions with shifts in current week */}
                          {positionsWithShiftsInWeek.map(({ position, positionId, shifts: positionShifts }, posIndex) => {
                            // Count unique employees for this position
                            const uniqueEmployees = new Set(positionShifts.map(s => s.user_id).filter(id => id !== null))
                            const _employeeCount = uniqueEmployees.size
                            
                            return (
                              <div key={positionId || `no-position-${posIndex}`} className="grid grid-cols-8 border-b border-gray-200" style={{ height: '100px', position: 'relative' }}>
                                {/* Position Name Column */}
                                <div className="border-r border-gray-200 bg-gray-50 p-3 flex items-center">
                                  <div className="flex items-center space-x-3">
                                    <div 
                                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs"
                                      style={{ backgroundColor: position?.color || '#3b82f6' }}
                                    >
                                      {position ? position.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{position?.name || 'Keine Position'}</div>
                                      <div className="text-xs text-gray-500">{positionShifts.length} Schicht{positionShifts.length !== 1 ? 'en' : ''}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Day Columns */}
                                {getWeekDays(currentWeek).map((date, dayIndex) => {
                                  // Get shifts for this position and date
                                  const dayShifts = positionShifts.filter(shift => {
                                    const shiftDate = new Date(shift.start_time)
                                    return shiftDate.toDateString() === date.toDateString()
                                  })
                                  const timeRange = getDayTimeRange()

                                  return (
                                    <div
                                      key={dayIndex}
                                      className={`border-r border-gray-200 last:border-r-0 relative bg-white hover:bg-gray-50 transition-colors ${
                                        copyingShift ? 'cursor-copy hover:bg-blue-50 border-blue-200' : ''
                                      }`}
                                      style={{ height: '100px' }}
                                      onDrop={(e) => {
                                        e.preventDefault()
                                        handleTimeSlotDrop(e, date)
                                      }}
                                      onDragOver={handleTimeSlotDragOver}
                                      onClick={(e) => {
                                        if (user?.role === 'manager' || user?.role === 'owner') {
                                          if (copyingShift) {
                                            handlePasteShift(date)
                                          } else {
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const y = e.clientY - rect.top
                                            const totalMinutes = ((y / 100) * (timeRange.end - timeRange.start) * 60)
                                            const hour = Math.floor(totalMinutes / 60) + timeRange.start
                                            const minute = Math.floor((totalMinutes % 60) / 15) * 15
                                            const slotDate = new Date(date)
                                            slotDate.setHours(hour, minute, 0, 0)
                                            
                                            setFormData({
                                              user_id: '',
                                              start_time: slotDate.toISOString().slice(0, 16),
                                              end_time: new Date(slotDate.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16),
                                              position_id: positionId || '',
                                              position: '',
                                              notes: '',
                                              status: 'scheduled'
                                            })
                                            setShowShiftDialog(true)
                                            setShowCreateForm(true)
                                          }
                                        }
                                      }}
                                    >
                                      {/* Render Vacation (full day) */}
                                      {getVacationForDate(date).map((vacation) => {
                                        const vacationUser = organizationUsers.find(u => u.id === vacation.user_id)
                                        if (!vacationUser) return null
                                        
                                        return (
                                          <div
                                            key={`vacation-${vacation.id}-${date.toISOString()}`}
                                            className="absolute left-1 right-1 top-0 bottom-0 bg-green-100 border-2 border-green-400 rounded-lg px-1.5 py-0.5 flex items-center justify-center z-5"
                                            style={{ opacity: 0.7 }}
                                            title={`Urlaub: ${vacationUser.name}`}
                                          >
                                            <div className="text-xs font-medium text-green-800 truncate">
                                              🏖️ {vacationUser.name} (Urlaub)
                                            </div>
                                          </div>
                                        )
                                      })}
                                      
                                      {/* Render Shifts */}
                                      {dayShifts.map((shift) => {
                                        const startTime = new Date(shift.start_time)
                                        const endTime = new Date(shift.end_time)
                                        const startHour = startTime.getHours() + (startTime.getMinutes() / 60)
                                        const endHour = endTime.getHours() + (endTime.getMinutes() / 60)
                                        const duration = endHour - startHour
                                        
                                        const topPercent = ((startHour - timeRange.start) / (timeRange.end - timeRange.start)) * 100
                                        const heightPercent = (duration / (timeRange.end - timeRange.start)) * 100
                                        
                                        // Get employee name for this shift
                                        const shiftEmployee = organizationUsers.find(u => u.id === shift.user_id)

                                        return (
                                          <div
                                            key={shift.id}
                                            draggable={user?.role === 'manager' || user?.role === 'owner'}
                                            onDragStart={(e) => {
                                              if (user?.role === 'manager' || user?.role === 'owner') {
                                                handleShiftDragStart(e, shift)
                                              } else {
                                                e.preventDefault()
                                              }
                                            }}
                                            onDragEnd={handleShiftDragEnd}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if ((user?.role === 'manager' || user?.role === 'owner') && !copyingShift) {
                                                handleEditShift(shift)
                                              }
                                            }}
                                            onContextMenu={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              if (user?.role === 'manager' || user?.role === 'owner') {
                                                handleCopyShift(shift, e)
                                              }
                                            }}
                                            className={`group absolute left-1 right-1 rounded-lg px-1.5 py-0.5 shadow-sm transition-all ${
                                              shift.status === 'cancelled'
                                                ? 'bg-red-100 text-red-800 border border-red-300'
                                                : shift.user_id === null
                                                ? 'bg-red-500 text-white border border-red-600'
                                                : shift.status === 'confirmed'
                                                ? 'bg-blue-500 text-white border border-blue-600'
                                                : 'bg-gray-500 text-white border border-gray-600'
                                            } ${
                                              (user?.role === 'manager' || user?.role === 'owner') 
                                                ? 'cursor-move hover:shadow-md' 
                                                : 'cursor-default'
                                            }`}
                                            style={{
                                              top: `${topPercent}%`,
                                              height: `${Math.max(heightPercent, 5)}%`,
                                              minHeight: '32px',
                                              zIndex: draggingShift?.id === shift.id ? 50 : 10,
                                              fontSize: '10px',
                                              lineHeight: '1.2'
                                            }}
                                          >
                                            <div className="flex items-start justify-between gap-1">
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate leading-tight" style={{ fontSize: '10px' }}>
                                                  {shiftEmployee?.name || shift.user?.name || 'Offene Schicht'}
                                                </div>
                                                <div className="truncate leading-tight mt-0.5 opacity-95" style={{ fontSize: '9px' }}>
                                                  {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                                </div>
                                              </div>
                                              {(user?.role === 'manager' || user?.role === 'owner') && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setShiftToDelete(shift)
                                                    setShowDeleteDialog(true)
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 hover:bg-white/20 rounded"
                                                  title="Schicht löschen"
                                                  style={{ fontSize: '8px' }}
                                                >
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                              )}
                                            </div>
                                            {shift.time_clock_entry && shift.time_clock_entry.length > 0 && (
                                              <div className="mt-0.5 pt-0.5 border-t border-white/20">
                                                <div className="opacity-80 truncate leading-tight" style={{ fontSize: '8px' }}>
                                                  {formatTime(shift.time_clock_entry[0].clock_in)}
                                                  {shift.time_clock_entry[0].clock_out && ` - ${formatTime(shift.time_clock_entry[0].clock_out)}`}
                                                </div>
                                                {shift.time_clock_entry[0].has_warning && (
                                                  <div className="text-yellow-200 font-medium truncate mt-0.5 flex items-center space-x-0.5 leading-tight" style={{ fontSize: '8px' }}>
                                                    <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
                                                    <span>Abweichung</span>
                                                  </div>
                                                )}
                                                {shift.time_clock_entry[0].is_approved && (
                                                  <div className="text-green-200 font-medium truncate mt-0.5 flex items-center space-x-0.5 leading-tight" style={{ fontSize: '8px' }}>
                                                    <CheckCircle className="h-2.5 w-2.5 flex-shrink-0" />
                                                    <span>Bestätigt</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                      
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    } else {
                      // Sort by name: show employees in Y-axis (original behavior)
                      const filteredEmployees = organizationUsers.filter(u => u.role !== 'owner')
                      const sortedEmployees = [...filteredEmployees].sort((a, b) => a.name.localeCompare(b.name))
                      
                      // Check if there are open shifts in the current week
                      const weekDays = getWeekDays(currentWeek)
                      const hasOpenShiftsInWeek = weekDays.some(date => {
                        const openShifts = getOpenShiftsForDate(date)
                        return openShifts.length > 0
                      })
                      
                      // Calculate total height: number of employees + 1 for open shifts row (if open shifts exist)
                      const totalRows = sortedEmployees.length + (hasOpenShiftsInWeek ? 1 : 0)
                      const containerHeight = totalRows * 100
                      
                      return (
                        <div key="name-mode" className="relative" style={{ height: `${containerHeight}px` }}>
                          {/* Employee Rows */}
                          {sortedEmployees.map((employee, _empIndex) => {
                            const _userShifts = shifts.filter(s => s.user_id === employee.id)
                            // Get employee positions
                            const employeePositions = userPositions
                              .filter(up => up.user_id === employee.id && up.position)
                              .map(up => up.position)
                              .filter((p): p is Position => p !== null && p !== undefined)
                            // Fallback to legacy position_id
                            const legacyPosition = employee.position_id ? positions.find(p => p.id === employee.position_id) : null
                            const allEmployeePositions = employeePositions.length > 0 
                              ? employeePositions 
                              : (legacyPosition ? [legacyPosition] : [])
                            const _primaryPosition = allEmployeePositions.length > 0 ? allEmployeePositions[0] : null
                            
                            return (
                              <div key={employee.id} className="grid grid-cols-8 border-b border-gray-200" style={{ height: '100px' }}>
                                {/* Employee Name Column */}
                                <div className="border-r border-gray-200 bg-gray-50 p-3 flex items-center">
                                  <div className="flex items-center space-x-3">
                                    {renderMultiPositionAvatar(allEmployeePositions, getInitials(employee.name), 32)}
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                                      {allEmployeePositions.length > 0 && (
                                        <div className="text-xs text-gray-500">
                                          {allEmployeePositions.map(p => p.name).join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Day Columns */}
                                {getWeekDays(currentWeek).map((date, dayIndex) => {
                                  const dayShifts = getShiftsForEmployeeAndDate(employee.id, date)
                                  const timeRange = getDayTimeRange()
                                  const _hourHeight = 100 / (timeRange.end - timeRange.start) // height per hour
                                  const employeeVacation = getVacationForDate(date).find(v => v.user_id === employee.id)

                                  return (
                                    <div
                                      key={dayIndex}
                                      className="border-r border-gray-200 last:border-r-0 relative bg-white hover:bg-gray-50 transition-colors"
                                      onDrop={(e) => {
                                        e.preventDefault()
                                        handleTimeSlotDrop(e, date)
                                      }}
                                      onDragOver={handleTimeSlotDragOver}
                                      onClick={(e) => {
                                        if (user?.role === 'manager' || user?.role === 'owner') {
                                          // If copying mode is active, paste the shift with same time
                                          if (copyingShift) {
                                            handlePasteShift(date, employee.id)
                                          } else {
                                            // Otherwise, create new shift based on click position
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const y = e.clientY - rect.top
                                            const totalMinutes = ((y / 100) * (timeRange.end - timeRange.start) * 60)
                                            const hour = Math.floor(totalMinutes / 60) + timeRange.start
                                            const minute = Math.floor((totalMinutes % 60) / 15) * 15
                                            const slotDate = new Date(date)
                                            slotDate.setHours(hour, minute, 0, 0)
                                            
                                            setFormData({
                                              user_id: employee.id,
                                              start_time: slotDate.toISOString().slice(0, 16),
                                              end_time: new Date(slotDate.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16),
                                              position_id: '',
                                              position: '',
                                              notes: '',
                                              status: 'scheduled'
                                            })
                                            setShowShiftDialog(true)
                                            setShowCreateForm(true)
                                          }
                                        }
                                      }}
                                      className={`border-r border-gray-200 last:border-r-0 relative bg-white hover:bg-gray-50 transition-colors ${
                                        copyingShift ? 'cursor-copy hover:bg-blue-50 border-blue-200' : ''
                                      }`}
                                    >
                                      {/* Render Vacation (full day) */}
                                      {employeeVacation && (
                                        <div
                                          className="absolute left-1 right-1 top-0 bottom-0 bg-green-100 border-2 border-green-400 rounded-lg px-1.5 py-0.5 flex items-center justify-center z-5"
                                          style={{ opacity: 0.7 }}
                                          title="Urlaub"
                                        >
                                          <div className="text-xs font-medium text-green-800 truncate">
                                            🏖️ Urlaub
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Render Shifts */}
                                      {dayShifts.map((shift) => {
                                        const startTime = new Date(shift.start_time)
                                        const endTime = new Date(shift.end_time)
                                        const startHour = startTime.getHours() + (startTime.getMinutes() / 60)
                                        const endHour = endTime.getHours() + (endTime.getMinutes() / 60)
                                        const duration = endHour - startHour
                                        
                                        const topPercent = ((startHour - timeRange.start) / (timeRange.end - timeRange.start)) * 100
                                        const heightPercent = (duration / (timeRange.end - timeRange.start)) * 100

                                        return (
                                          <div
                                            key={shift.id}
                                            draggable={user?.role === 'manager' || user?.role === 'owner'}
                                            onDragStart={(e) => {
                                              if (user?.role === 'manager' || user?.role === 'owner') {
                                                handleShiftDragStart(e, shift)
                                              } else {
                                                e.preventDefault()
                                              }
                                            }}
                                            onDragEnd={handleShiftDragEnd}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              // Only managers and owners can edit shifts
                                              if ((user?.role === 'manager' || user?.role === 'owner') && !copyingShift) {
                                                handleEditShift(shift)
                                              }
                                            }}
                                            onContextMenu={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              if (user?.role === 'manager' || user?.role === 'owner') {
                                                handleCopyShift(shift, e)
                                              }
                                            }}
                                            className={`group absolute left-1 right-1 rounded-lg px-1.5 py-0.5 shadow-sm transition-all ${
                                              shift.status === 'cancelled'
                                                ? 'bg-red-100 text-red-800 border border-red-300'
                                                : shift.user_id === null
                                                ? 'bg-red-500 text-white border border-red-600'
                                                : shift.status === 'confirmed'
                                                ? 'bg-blue-500 text-white border border-blue-600'
                                                : 'bg-gray-500 text-white border border-gray-600'
                                            } ${
                                              (user?.role === 'manager' || user?.role === 'owner') 
                                                ? 'cursor-move hover:shadow-md' 
                                                : 'cursor-default'
                                            }`}
                                            style={{
                                              top: `${topPercent}%`,
                                              height: `${Math.max(heightPercent, 5)}%`,
                                              minHeight: '32px',
                                              zIndex: draggingShift?.id === shift.id ? 50 : 10,
                                              fontSize: '10px',
                                              lineHeight: '1.2'
                                            }}
                                          >
                                            <div className="flex items-start justify-between gap-1">
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate leading-tight" style={{ fontSize: '10px' }}>
                                                  {typeof shift.position === 'object' && shift.position !== null 
                                                    ? (shift.position.name || 'Schicht')
                                                    : (typeof shift.position === 'string' ? shift.position : 'Schicht')}
                                                </div>
                                                <div className="truncate leading-tight mt-0.5 opacity-95" style={{ fontSize: '9px' }}>
                                                  {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                                </div>
                                              </div>
                                              {(user?.role === 'manager' || user?.role === 'owner') && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setShiftToDelete(shift)
                                                    setShowDeleteDialog(true)
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 hover:bg-white/20 rounded"
                                                  title="Schicht löschen"
                                                  style={{ fontSize: '8px' }}
                                                >
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                              )}
                                            </div>
                                            {shift.time_clock_entry && shift.time_clock_entry.length > 0 && (
                                              <div className="mt-0.5 pt-0.5 border-t border-white/20">
                                                <div className="opacity-80 truncate leading-tight" style={{ fontSize: '8px' }}>
                                                  {formatTime(shift.time_clock_entry[0].clock_in)}
                                                  {shift.time_clock_entry[0].clock_out && ` - ${formatTime(shift.time_clock_entry[0].clock_out)}`}
                                                </div>
                                                {shift.time_clock_entry[0].has_warning && (
                                                  <div className="text-yellow-200 font-medium truncate mt-0.5 flex items-center space-x-0.5 leading-tight" style={{ fontSize: '8px' }}>
                                                    <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
                                                    <span>Abweichung</span>
                                                  </div>
                                                )}
                                                {shift.time_clock_entry[0].is_approved && (
                                                  <div className="text-green-200 font-medium truncate mt-0.5 flex items-center space-x-0.5 leading-tight" style={{ fontSize: '8px' }}>
                                                    <CheckCircle className="h-2.5 w-2.5 flex-shrink-0" />
                                                    <span>Bestätigt</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                      
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                          
                          {/* Open Shifts Row - Only show if there are open shifts in the current week */}
                          {hasOpenShiftsInWeek && (
                            <div className="grid grid-cols-8 border-b border-gray-200" style={{ height: '100px' }}>
                              <div className="border-r border-gray-200 bg-gray-50 p-3 flex items-center">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="h-4 w-4 text-gray-500" />
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">Offene Schicht</div>
                                </div>
                              </div>
                              {getWeekDays(currentWeek).map((date, dayIndex) => {
                                const openShifts = getOpenShiftsForDate(date)
                                const timeRange = getDayTimeRange()
                                return (
                                  <div
                                    key={dayIndex}
                                    className="border-r border-gray-200 last:border-r-0 relative bg-white hover:bg-gray-50 transition-colors"
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      handleTimeSlotDrop(e, date)
                                    }}
                                    onDragOver={(e) => handleTimeSlotDragOver(e, date)}
                                    onClick={(e) => {
                                      if (user?.role === 'manager' || user?.role === 'owner') {
                                        // If copying mode is active, paste the shift (as open shift)
                                        if (copyingShift) {
                                          handlePasteShift(date) // Don't pass userId to keep as open shift
                                        } else {
                                          // Otherwise, create new shift based on click position
                                          const rect = e.currentTarget.getBoundingClientRect()
                                          const y = e.clientY - rect.top
                                          const totalMinutes = ((y / 100) * (timeRange.end - timeRange.start) * 60)
                                          const hour = Math.floor(totalMinutes / 60) + timeRange.start
                                          const minute = Math.floor((totalMinutes % 60) / 15) * 15
                                          const slotDate = new Date(date)
                                          slotDate.setHours(hour, minute, 0, 0)
                                          
                                          setFormData({
                                            user_id: '',
                                            start_time: slotDate.toISOString().slice(0, 16),
                                            end_time: new Date(slotDate.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16),
                                            position_id: '',
                                            position: '',
                                            notes: '',
                                            status: 'scheduled'
                                          })
                                          setShowShiftDialog(true)
                                          setShowCreateForm(true)
                                        }
                                      }
                                    }}
                                  >
                                    {/* Render Open Shifts */}
                                    {openShifts.map((shift) => {
                                      const startTime = new Date(shift.start_time)
                                      const endTime = new Date(shift.end_time)
                                      const startHour = startTime.getHours() + (startTime.getMinutes() / 60)
                                      const endHour = endTime.getHours() + (endTime.getMinutes() / 60)
                                      const duration = endHour - startHour
                                      
                                      const topPercent = ((startHour - timeRange.start) / (timeRange.end - timeRange.start)) * 100
                                      const heightPercent = (duration / (timeRange.end - timeRange.start)) * 100

                                      return (
                                        <div
                                          key={shift.id}
                                          draggable={user?.role === 'manager' || user?.role === 'owner'}
                                          onDragStart={(e) => {
                                            if (user?.role === 'manager' || user?.role === 'owner') {
                                              handleShiftDragStart(e, shift)
                                            } else {
                                              e.preventDefault()
                                            }
                                          }}
                                          onDragEnd={handleShiftDragEnd}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if ((user?.role === 'manager' || user?.role === 'owner') && !copyingShift) {
                                              handleEditShift(shift)
                                            }
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            if (user?.role === 'manager' || user?.role === 'owner') {
                                              handleCopyShift(shift, e)
                                            }
                                          }}
                                          className={`group absolute left-1 right-1 rounded-lg px-1.5 py-0.5 shadow-sm transition-all text-white border ${
                                            (user?.role === 'manager' || user?.role === 'owner') 
                                              ? 'cursor-move hover:shadow-md' 
                                              : 'cursor-default'
                                          }`}
                                          style={{
                                            top: `${topPercent}%`,
                                            height: `${Math.max(heightPercent, 5)}%`,
                                            minHeight: '32px',
                                            zIndex: draggingShift?.id === shift.id ? 50 : 10,
                                            fontSize: '10px',
                                            lineHeight: '1.2',
                                            backgroundColor: shift.user_id === null
                                              ? '#ef4444'
                                              : shift.status === 'confirmed'
                                              ? '#22c55e'
                                              : '#6b7280',
                                            borderColor: shift.user_id === null
                                              ? '#dc2626'
                                              : shift.status === 'confirmed'
                                              ? '#16a34a'
                                              : '#4b5563'
                                          }}
                                        >
                                          <div className="flex items-start justify-between gap-1">
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium truncate leading-tight" style={{ fontSize: '10px' }}>
                                                {typeof shift.position === 'object' && shift.position !== null
                                                  ? (shift.position.name || 'Offene Schicht')
                                                  : (typeof shift.position === 'string' ? shift.position : 'Offene Schicht')}
                                              </div>
                                              <div className="truncate leading-tight mt-0.5 opacity-95" style={{ fontSize: '9px' }}>
                                                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                              </div>
                                            </div>
                                            {(user?.role === 'manager' || user?.role === 'owner') && (
                                              <>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    // Create simple dropdown for assigning employee
                                                    const assignMenu = document.createElement('div')
                                                    assignMenu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-2 min-w-[200px]'
                                                    assignMenu.style.left = `${e.clientX}px`
                                                    assignMenu.style.top = `${e.clientY}px`
                                                    const usersList = organizationUsers
                                                      .filter(u => u.role !== 'owner')
                                                      .map(u => `<button class="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded" onclick="window.handleAssignToShift('${shift.id}', '${u.id}')">${u.name}</button>`)
                                                      .join('')
                                                    assignMenu.innerHTML = 
                                                      '<div class="text-xs font-medium text-gray-700 mb-2">Mitarbeiter zuordnen:</div>' +
                                                      usersList +
                                                      '<button class="w-full text-left px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded mt-2" onclick="document.body.removeChild(this.parentElement)">Abbrechen</button>'
                                                    document.body.appendChild(assignMenu)
                                                    
                                                    // Remove menu when clicking outside
                                                    setTimeout(() => {
                                                      const removeMenu = (clickEvent: MouseEvent) => {
                                                        if (!assignMenu.contains(clickEvent.target as Node)) {
                                                          document.body.removeChild(assignMenu)
                                                          document.removeEventListener('click', removeMenu)
                                                        }
                                                      }
                                                      document.addEventListener('click', removeMenu)
                                                    }, 100)
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 hover:bg-white/20 rounded mr-1"
                                                  title="Mitarbeiter zuordnen"
                                                  style={{ fontSize: '8px' }}
                                                >
                                                  <Plus className="h-2.5 w-2.5" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setShiftToDelete(shift)
                                                    setShowDeleteDialog(true)
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 hover:bg-white/20 rounded"
                                                  title="Schicht löschen"
                                                  style={{ fontSize: '8px' }}
                                                >
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                    
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shifts List */}
        {viewMode === 'list' && (
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
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 flex-wrap">
                            <h3 className="text-sm font-medium text-gray-900">
                              {shift.user?.name || 'Unknown Employee'}
                            </h3>
                            {shift.position && (
                              <span className="text-xs text-gray-500">• {typeof shift.position === 'object' && shift.position !== null ? shift.position.name : shift.position}</span>
                            )}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              shiftStatus.color === 'green' ? 'bg-green-100 text-green-700' :
                              shiftStatus.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                              shiftStatus.color === 'red' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {shiftStatus.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mt-1 flex-wrap">
                            <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500">{formatDate(shift.start_time)}</span>
                          </div>
                          <div className="flex items-center space-x-2 mt-1 flex-wrap">
                            <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500">
                              Geplant: {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                            </span>
                          </div>
                          {shift.time_clock_entry && shift.time_clock_entry.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                <span className="text-xs text-blue-600">
                                  Gestempelt: {formatTime(shift.time_clock_entry[0].clock_in)}
                                  {shift.time_clock_entry[0].clock_out && ` - ${formatTime(shift.time_clock_entry[0].clock_out)}`}
                                </span>
                              </div>
                              {shift.time_clock_entry[0].clock_in_deviation_minutes && (
                                <div className="text-xs text-gray-500 ml-5">
                                  Abweichung Start: {shift.time_clock_entry[0].clock_in_deviation_minutes > 0 ? '+' : ''}
                                  {shift.time_clock_entry[0].clock_in_deviation_minutes} Min
                                </div>
                              )}
                              {shift.time_clock_entry[0].clock_out_deviation_minutes && (
                                <div className="text-xs text-gray-500 ml-5">
                                  Abweichung Ende: {shift.time_clock_entry[0].clock_out_deviation_minutes > 0 ? '+' : ''}
                                  {shift.time_clock_entry[0].clock_out_deviation_minutes} Min
                                </div>
                              )}
                              {shift.time_clock_entry[0].has_warning && (
                                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-5">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Abweichung &gt; 30 Min
                                </div>
                              )}
                              {shift.time_clock_entry[0].is_approved && (
                                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-5">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Bestätigt
                                </div>
                              )}
                            </div>
                          )}
                          {shift.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-600">{shift.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {(user?.role === 'manager' || user?.role === 'owner') && (
                        <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                          {shift.time_clock_entry && shift.time_clock_entry.length > 0 && !shift.time_clock_entry[0].is_approved && (
                            <button
                              onClick={() => handleApproveTimeEntry(shift.time_clock_entry![0].id)}
                              className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                              title="Zeiterfassung bestätigen"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditShift(shift)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Edit shift"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setShiftToDelete(shift)
                              setShowDeleteDialog(true)
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete shift"
                          >
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
        )}

        {/* Approvals View */}
        {viewMode === 'approvals' && (user?.role === 'manager' || user?.role === 'owner') && (
          <div className="space-y-4">
          {/* Employee Hours Summary */}
          <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Stundenübersicht pro Mitarbeiter</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Aufsummierte Stunden aus bestätigten Zeitstempelungen
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={hoursSummaryMonth}
                    onChange={(e) => setHoursSummaryMonth(parseInt(e.target.value))}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  >
                    <option value="1">Januar</option>
                    <option value="2">Februar</option>
                    <option value="3">März</option>
                    <option value="4">April</option>
                    <option value="5">Mai</option>
                    <option value="6">Juni</option>
                    <option value="7">Juli</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">Oktober</option>
                    <option value="11">November</option>
                    <option value="12">Dezember</option>
                  </select>
                  <select
                    value={hoursSummaryYear}
                    onChange={(e) => setHoursSummaryYear(parseInt(e.target.value))}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {(() => {
                // Stunden laut Stempeluhr (time clock entries)
                const employeeClockHours = new Map<string, { name: string; totalMinutes: number; entryCount: number }>()
                
                // Filter by selected month and year
                const filteredEntries = timeClockEntries.filter(e => {
                  if (!e.is_approved || !e.clock_out || !e.user) return false
                  const entryDate = new Date(e.clock_in)
                  const entryMonth = entryDate.getMonth() + 1 // 1-12
                  const entryYear = entryDate.getFullYear()
                  return entryMonth === hoursSummaryMonth && entryYear === hoursSummaryYear
                })
                
                filteredEntries
                  .forEach(entry => {
                    if (!entry.user) return
                    const userId = entry.user.id
                    const existing = employeeClockHours.get(userId)
                    
                    if (entry.clock_in && entry.clock_out) {
                      const minutes = Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60))
                      
                      if (existing) {
                        existing.totalMinutes += minutes
                        existing.entryCount += 1
                      } else {
                        employeeClockHours.set(userId, {
                          name: entry.user.name,
                          totalMinutes: minutes,
                          entryCount: 1
                        })
                      }
                    }
                  })
                
                // Stunden laut Schichtplan (shifts)
                const employeeShiftHours = new Map<string, { name: string; totalMinutes: number; shiftCount: number }>()
                
                const filteredShifts = shifts.filter(shift => {
                  if (!shift.user_id || shift.status === 'cancelled') return false
                  const shiftDate = new Date(shift.start_time)
                  const shiftMonth = shiftDate.getMonth() + 1 // 1-12
                  const shiftYear = shiftDate.getFullYear()
                  return shiftMonth === hoursSummaryMonth && shiftYear === hoursSummaryYear
                })
                
                filteredShifts.forEach(shift => {
                  if (!shift.user_id) return
                  const userId = shift.user_id
                  const existing = employeeShiftHours.get(userId)
                  const employee = organizationUsers.find(u => u.id === userId)
                  
                  if (shift.start_time && shift.end_time) {
                    const minutes = Math.round((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60))
                    
                    if (existing) {
                      existing.totalMinutes += minutes
                      existing.shiftCount += 1
                    } else {
                      employeeShiftHours.set(userId, {
                        name: employee?.name || 'Unbekannt',
                        totalMinutes: minutes,
                        shiftCount: 1
                      })
                    }
                  }
                })
                
                // Alle Mitarbeiter zusammenführen (sowohl aus Schichtplan als auch aus Stempeluhr)
                const allEmployeeIds = new Set([
                  ...Array.from(employeeClockHours.keys()),
                  ...Array.from(employeeShiftHours.keys())
                ])
                
                const sortedEmployees = Array.from(allEmployeeIds)
                  .map(userId => {
                    const clockData = employeeClockHours.get(userId) || { name: '', totalMinutes: 0, entryCount: 0 }
                    const shiftData = employeeShiftHours.get(userId) || { name: '', totalMinutes: 0, shiftCount: 0 }
                    const employee = organizationUsers.find(u => u.id === userId)
                    const name = clockData.name || shiftData.name || employee?.name || 'Unbekannt'
                    const totalMinutes = Math.max(clockData.totalMinutes, shiftData.totalMinutes) // Für Sortierung
                    
                    return {
                      userId,
                      name,
                      clockMinutes: clockData.totalMinutes,
                      clockCount: clockData.entryCount,
                      shiftMinutes: shiftData.totalMinutes,
                      shiftCount: shiftData.shiftCount,
                      totalMinutes
                    }
                  })
                  .sort((a, b) => b.totalMinutes - a.totalMinutes)
                
                if (sortedEmployees.length === 0) {
                  return (
                    <div className="px-6 py-8 text-center">
                      <p className="text-xs text-gray-500">Noch keine Stunden vorhanden</p>
                    </div>
                  )
                }
                
                return (
                  <>
                    {/* Header */}
                    <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                        <div className="flex items-center space-x-2 flex-1">
                          <div className="w-8"></div>
                          <div className="flex-1">Mitarbeiter</div>
                        </div>
                        <div className="flex items-center space-x-8">
                          <div className="text-right w-24">
                            <div>Laut Schichtplan</div>
                          </div>
                          <div className="text-right w-24">
                            <div>Laut Stempeluhr</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Employee Rows */}
                    {sortedEmployees.map(({ userId, name, clockMinutes, clockCount, shiftMinutes, shiftCount }) => {
                      const clockHours = Math.floor(clockMinutes / 60)
                      const clockMins = clockMinutes % 60
                      const shiftHours = Math.floor(shiftMinutes / 60)
                      const shiftMins = shiftMinutes % 60
                      const _employee = organizationUsers.find(u => u.id === userId)
                      
                      return (
                        <div key={userId} className="px-6 py-2 hover:bg-gray-50 transition-colors h-16 flex items-center">
                          <div className="flex items-center justify-between text-xs w-full">
                            <div className="flex items-center space-x-2 flex-1">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-600 font-medium text-xs">
                                  {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{name}</p>
                                {(shiftCount > 0 || clockCount > 0) && (
                                  <p className="text-gray-500">
                                    {shiftCount > 0 && `${shiftCount} Schicht${shiftCount !== 1 ? 'en' : ''}`}
                                    {shiftCount > 0 && clockCount > 0 && ' / '}
                                    {clockCount > 0 && `${clockCount} Eintrag${clockCount !== 1 ? 'e' : ''}`}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-8">
                              <div className="text-right w-24 h-[2.5rem] flex items-center justify-end">
                                {shiftCount > 0 ? (
                                  <p className="font-semibold text-gray-900">
                                    {shiftHours}h {shiftMins.toString().padStart(2, '0')}m
                                  </p>
                                ) : (
                                  <p className="text-gray-400 text-xs">-</p>
                                )}
                              </div>
                              <div className="text-right w-24 h-[2.5rem] flex items-center justify-end">
                                {clockCount > 0 ? (
                                  <p className="font-semibold text-gray-900">
                                    {clockHours}h {clockMins.toString().padStart(2, '0')}m
                                  </p>
                                ) : (
                                  <p className="text-gray-400 text-xs">-</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          </div>

          {/* Time Clock Entries */}
          <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Zeiterfassung bestätigen</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Überprüfen und bestätigen Sie alle gestempelten Zeiten
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setApprovalFilter('pending')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        approvalFilter === 'pending'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Ausstehend
                    </button>
                    <button
                      onClick={() => setApprovalFilter('approved')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        approvalFilter === 'approved'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Bestätigt
                    </button>
                    <button
                      onClick={() => setApprovalFilter('all')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        approvalFilter === 'all'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Alle
                    </button>
                  </div>
                  {selectedEntries.size > 0 && approvalFilter === 'pending' && (
                    <button
                      onClick={handleBulkApprove}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 text-sm"
                    >
                      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{selectedEntries.size} bestätigen</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {(() => {
                let filteredEntries = timeClockEntries.filter(e => e.clock_out)
                
                if (approvalFilter === 'pending') {
                  filteredEntries = filteredEntries.filter(e => !e.is_approved)
                } else if (approvalFilter === 'approved') {
                  filteredEntries = filteredEntries.filter(e => e.is_approved)
                }
                
                if (filteredEntries.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <FileCheck className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {approvalFilter === 'pending' ? 'Keine ausstehenden Bestätigungen' : 
                         approvalFilter === 'approved' ? 'Keine bestätigten Einträge' : 
                         'Keine Einträge gefunden'}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {approvalFilter === 'pending' ? 'Alle Zeitstempelungen wurden bereits bestätigt.' :
                         approvalFilter === 'approved' ? 'Noch keine bestätigten Zeitstempelungen vorhanden.' :
                         'Keine Zeitstempelungen vorhanden.'}
                      </p>
                    </div>
                  )
                }
                
                return filteredEntries.map((entry) => (
                  <div key={entry.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      {!entry.is_approved && (
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedEntries)
                            if (e.target.checked) {
                              newSelected.add(entry.id)
                            } else {
                              newSelected.delete(entry.id)
                            }
                            setSelectedEntries(newSelected)
                          }}
                          className="h-3.5 w-3.5 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                        />
                      )}
                      {entry.is_approved && <div className="w-3.5" />}
                      
                      <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center text-xs">
                        {/* Mitarbeiter */}
                        <div className="col-span-2">
                          <p className="font-medium text-gray-900 truncate">
                            {entry.user?.name || 'Unbekannt'}
                          </p>
                        </div>
                        
                        {/* Geplante Schicht */}
                        <div className="col-span-2 text-gray-600">
                          {entry.shift ? (
                            <span>
                              {new Date(entry.shift.start_time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} {formatTime(entry.shift.start_time)}-{formatTime(entry.shift.end_time)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                        
                        {/* Gestempelte Zeit */}
                        <div className="col-span-2 text-green-700 font-medium">
                          {new Date(entry.clock_in).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} {formatTime(entry.clock_in)}-{formatTime(entry.clock_out!)}
                        </div>
                        
                        {/* Dauer */}
                        <div className="col-span-1 text-gray-500">
                          {entry.clock_in && entry.clock_out && (
                            <span>{Math.round((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60))} Min</span>
                          )}
                        </div>
                        
                        {/* Abweichungen */}
                        <div className="col-span-2">
                          {(entry.clock_in_deviation_minutes !== null || entry.clock_out_deviation_minutes !== null) ? (
                            <div className="flex items-center space-x-1">
                              {entry.has_warning && (
                                <AlertCircle className="h-3 w-3 text-yellow-600" />
                              )}
                              <span className="text-yellow-700">
                                {entry.clock_in_deviation_minutes !== null && `${entry.clock_in_deviation_minutes > 0 ? '+' : ''}${entry.clock_in_deviation_minutes}`}
                                {entry.clock_in_deviation_minutes !== null && entry.clock_out_deviation_minutes !== null && '/ '}
                                {entry.clock_out_deviation_minutes !== null && `${entry.clock_out_deviation_minutes > 0 ? '+' : ''}${entry.clock_out_deviation_minutes}`} Min
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="col-span-3 flex items-center justify-end space-x-1">
                          {entry.is_approved && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                              <CheckCircle className="h-3 w-3" />
                              <span>Bestätigt</span>
                            </div>
                          )}
                          {!entry.is_approved && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingTimeEntry(entry)
                                  setShowEditTimeEntryModal(true)
                                }}
                                disabled={isSaving}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                title="Ändern"
                              >
                                <Edit className="h-3 w-3" />
                                <span>Ändern</span>
                              </button>
                              <button
                                onClick={() => handleApproveTimeEntry(entry.id)}
                                disabled={isSaving}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                title="Bestätigen"
                              >
                                <CheckCircle className="h-3 w-3" />
                                <span>Bestätigen</span>
                              </button>
                              <button
                                onClick={() => handleRejectTimeEntry(entry.id)}
                                disabled={isSaving}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                title="Ablehnen"
                              >
                                <XCircle className="h-3 w-3" />
                                <span>Ablehnen</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Edit Time Entry Modal */}
      {showEditTimeEntryModal && editingTimeEntry && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setShowEditTimeEntryModal(false)
              setEditingTimeEntry(null)
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Zeitstempelung ändern</h3>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  handleUpdateTimeEntry({
                    clock_in: formData.get('clock_in') as string,
                    clock_out: formData.get('clock_out') as string || undefined,
                  })
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einstempeln
                  </label>
                  <input
                    type="datetime-local"
                    name="clock_in"
                    defaultValue={editingTimeEntry.clock_in ? new Date(editingTimeEntry.clock_in).toISOString().slice(0, 16) : ''}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ausstempeln
                  </label>
                  <input
                    type="datetime-local"
                    name="clock_out"
                    defaultValue={editingTimeEntry.clock_out ? new Date(editingTimeEntry.clock_out).toISOString().slice(0, 16) : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-gray-900 focus:border-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leer lassen, wenn noch nicht ausgestempelt</p>
                </div>
                
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditTimeEntryModal(false)
                      setEditingTimeEntry(null)
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Speichern</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit Shift Modal */}
      {showEditModal && editingShift && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={handleCancelForm}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="bg-white rounded-2xl flat-shadow-lg overflow-hidden w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Schicht bearbeiten</h2>
                <p className="text-sm text-gray-600">Schicht-Details aktualisieren</p>
              </div>
              <div className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                
                <form onSubmit={handleUpdateShift} className="space-y-4">
                  {/* Position Selection */}
                  <div>
                    <label htmlFor="edit_position_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Position <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="edit_position_id"
                      required
                      value={formData.position_id}
                      onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    >
                      <option value="">Position auswählen</option>
                      {positions.filter(p => p.is_active).map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Employee Selection - Optional */}
                  <div>
                    <label htmlFor="edit_user_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Mitarbeiter
                      <span className="text-xs text-gray-500 ml-1">(Optional - leer lassen für offene Schicht)</span>
                    </label>
                    <select
                      id="edit_user_id"
                      value={formData.user_id}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    >
                      <option value="">Offene Schicht (kein Mitarbeiter)</option>
                      {organizationUsers.filter(u => u.role !== 'owner').map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email}) - {user.role}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start Time */}
                  <div>
                    <label htmlFor="edit_start_time" className="block text-sm font-medium text-gray-700 mb-1">
                      Startzeit <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      id="edit_start_time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label htmlFor="edit_end_time" className="block text-sm font-medium text-gray-700 mb-1">
                      Endzeit <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      id="edit_end_time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label htmlFor="edit_status" className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      id="edit_status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'scheduled' | 'confirmed' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    >
                      <option value="scheduled">Geplant</option>
                      <option value="confirmed">Bestätigt</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="edit_notes" className="block text-sm font-medium text-gray-700 mb-1">
                      Notizen
                    </label>
                    <textarea
                      id="edit_notes"
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Zusätzliche Notizen oder Anweisungen..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={handleCancelForm}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>Schicht aktualisieren</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && shiftToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Shift</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete the shift for <strong>{shiftToDelete.user?.name || 'this employee'}</strong> on {formatDate(shiftToDelete.start_time)}?
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false)
                  setShiftToDelete(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteShift}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Positions Management Modal */}
      {showPositionsModal && (user?.role === 'manager' || user?.role === 'owner') && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setShowPositionsModal(false)
              setEditingPosition(null)
              setPositionFormData({ name: '', description: '', color: '' })
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingPosition ? 'Position bearbeiten' : 'Positionen verwalten'}
                </h2>
                <p className="text-sm text-gray-600">
                  {editingPosition ? 'Position-Details aktualisieren' : 'Erstellen und verwalten Sie Positionen'}
                </p>
              </div>
              <div className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Position Form */}
                <form onSubmit={editingPosition ? handleUpdatePosition : handleCreatePosition} className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                  <div>
                    <label htmlFor="position_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="position_name"
                      required
                      value={positionFormData.name}
                      onChange={(e) => setPositionFormData({ ...positionFormData, name: e.target.value })}
                      placeholder="z.B. Kellner, Koch, Host"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="position_description" className="block text-sm font-medium text-gray-700 mb-1">
                      Beschreibung
                    </label>
                    <textarea
                      id="position_description"
                      rows={2}
                      value={positionFormData.description}
                      onChange={(e) => setPositionFormData({ ...positionFormData, description: e.target.value })}
                      placeholder="Optionale Beschreibung..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="position_color" className="block text-sm font-medium text-gray-700 mb-1">
                      Farbe (Hex)
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        id="position_color"
                        value={positionFormData.color || '#3b82f6'}
                        onChange={(e) => setPositionFormData({ ...positionFormData, color: e.target.value })}
                        className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={positionFormData.color || ''}
                        onChange={(e) => setPositionFormData({ ...positionFormData, color: e.target.value })}
                        placeholder="#3b82f6"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>{editingPosition ? 'Position aktualisieren' : 'Position erstellen'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPositionsModal(false)
                        setEditingPosition(null)
                        setPositionFormData({ name: '', description: '', color: '' })
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>

                {/* Positions List */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Aktive Positionen</h3>
                  {positions.filter(p => p.is_active).length === 0 ? (
                    <p className="text-sm text-gray-500">Noch keine Positionen erstellt</p>
                  ) : (
                    <div className="space-y-2">
                      {positions.filter(p => p.is_active).map((position) => (
                        <div
                          key={position.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                              style={{ backgroundColor: position.color || '#3b82f6' }}
                            >
                              {position.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{position.name}</div>
                              {position.description && (
                                <div className="text-xs text-gray-500">{position.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditPosition(position)}
                              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Bearbeiten"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePosition(position.id)}
                              disabled={isSaving}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Employee Positions Modal */}
      {showEmployeePositionsModal && editingEmployee && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 backdrop-blur-sm"
            onClick={() => {
              setShowEmployeePositionsModal(false)
              setEditingEmployee(null)
              setSelectedPositionIds(new Set())
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <Briefcase className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Positionen verwalten</h3>
                      <p className="text-sm text-gray-600 mt-0.5">{editingEmployee.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowEmployeePositionsModal(false)
                      setEditingEmployee(null)
                      setSelectedPositionIds(new Set())
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Positions List with Checkboxes */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    <span>Verfügbare Positionen</span>
                    {selectedPositionIds.size > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {selectedPositionIds.size} ausgewählt
                      </span>
                    )}
                  </h4>
                  {positions.filter(p => p.is_active).length === 0 ? (
                    <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-500">Keine Positionen verfügbar</p>
                      <p className="text-xs text-gray-400 mt-1">Erstellen Sie zuerst Positionen</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {positions
                        .filter(p => p.is_active)
                        .map((position) => {
                          const isSelected = selectedPositionIds.has(position.id)
                          return (
                            <label
                              key={position.id}
                              className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handlePositionToggle(position.id)}
                                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                />
                              </div>
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md"
                                style={{ backgroundColor: position.color || '#3b82f6' }}
                              >
                                {position.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900">{position.name}</div>
                                {position.description && (
                                  <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{position.description}</div>
                                )}
                              </div>
                              {isSelected && (
                                <div className="flex-shrink-0">
                                  <Check className="h-5 w-5 text-blue-600" />
                                </div>
                              )}
                            </label>
                          )
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowEmployeePositionsModal(false)
                      setEditingEmployee(null)
                      setSelectedPositionIds(new Set())
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSaveEmployeePositions}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
                    <span>Speichern</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create Template Modal */}
      {showCreateTemplateModal && (user?.role === 'manager' || user?.role === 'owner') && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setShowCreateTemplateModal(false)
              setTemplateName('')
              setTemplateDescription('')
              setError(null)
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Vorlage erstellen</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Erstellen Sie eine Vorlage aus der aktuellen Woche
                </p>
              </div>
              <div className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <form onSubmit={(e) => {
                  e.preventDefault()
                  handleCreateTemplateFromWeek()
                }} className="space-y-4">
                  <div>
                    <label htmlFor="template_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="template_name"
                      required
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="z.B. Standard-Woche, Sommer-Woche"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="template_description" className="block text-sm font-medium text-gray-700 mb-1">
                      Beschreibung (optional)
                    </label>
                    <textarea
                      id="template_description"
                      rows={3}
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Optionale Beschreibung der Vorlage..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateTemplateModal(false)
                        setTemplateName('')
                        setTemplateDescription('')
                        setError(null)
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>Vorlage erstellen</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Apply Template Modal */}
      {showApplyTemplateModal && (user?.role === 'manager' || user?.role === 'owner') && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setShowApplyTemplateModal(false)
              setSelectedTemplate(null)
              setError(null)
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Vorlage anwenden</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Wählen Sie eine Vorlage aus, die auf die aktuelle Woche angewendet werden soll
                </p>
              </div>
              <div className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {templates.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      Keine Vorlagen vorhanden
                    </h3>
                    <p className="text-xs text-gray-600 mb-4">
                      Erstellen Sie zuerst eine Vorlage aus einer Woche
                    </p>
                    <button
                      onClick={() => {
                        setShowApplyTemplateModal(false)
                        setShowCreateTemplateModal(true)
                      }}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                    >
                      Vorlage erstellen
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                            {template.description && (
                              <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {template.shift_template_items?.length || 0} Schicht{template.shift_template_items?.length !== 1 ? 'en' : ''}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {selectedTemplate?.id === template.id && (
                              <Check className="h-5 w-5 text-blue-600" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTemplate(template.id)
                              }}
                              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              title="Vorlage löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {templates.length > 0 && (
                  <div className="flex items-center justify-end space-x-3 pt-4 mt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowApplyTemplateModal(false)
                        setSelectedTemplate(null)
                        setError(null)
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={() => {
                        if (selectedTemplate) {
                          const weekDays = getWeekDays(currentWeek)
                          handleApplyTemplate(selectedTemplate, weekDays[0])
                        } else {
                          setError('Bitte wählen Sie eine Vorlage aus')
                        }
                      }}
                      disabled={isSaving || !selectedTemplate}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>Vorlage anwenden</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
