'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Plus, 
  Users, 
  Mail, 
  User, 
  Edit,
  Trash2,
  ArrowLeft,
  Settings,
  LogOut,
  Loader2,
  Key,
  MoreVertical,
  UserCheck,
  UserX,
  Briefcase,
  X,
  Check
} from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: 'owner' | 'manager' | 'staff'
  is_active: boolean
  last_login: string | null
  hourly_rate: number | null
  employment_type: 'mini' | 'teilzeit' | 'vollzeit' | 'werkstudent' | null
  created_at: string
  positions?: Position[]
}

interface Position {
  id: string
  name: string
  description: string | null
  color: string | null
  is_active: boolean
  organization_id: string
}

interface UserPosition {
  id: string
  user_id: string
  position_id: string
  position?: Position
}

interface CreateUserData {
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
  password: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [userPositions, setUserPositions] = useState<UserPosition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)
  const [showPositionsDialog, setShowPositionsDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [resettingUser, setResettingUser] = useState<User | null>(null)
  const [managingPositionsUser, setManagingPositionsUser] = useState<User | null>(null)
  const [isAssigningPosition, setIsAssigningPosition] = useState(false)
  const [isRemovingPosition, setIsRemovingPosition] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [openUserMenu, setOpenUserMenu] = useState<string | null>(null)
  const [createFormData, setCreateFormData] = useState<CreateUserData>({
    name: '',
    email: '',
    role: 'staff',
    password: ''
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'staff' as 'owner' | 'manager' | 'staff',
    hourly_rate: '' as string | number,
    employment_type: '' as 'mini' | 'teilzeit' | 'vollzeit' | 'werkstudent' | '' | null,
    vacation_days: '' as string | number
  })
  const [currentVacationBalance, setCurrentVacationBalance] = useState<{
    id: string
    total_days: number
    used_days: number
    remaining_days: number
  } | null>(null)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkAuthAndFetchUsers()
  }, [])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      if (openUserMenu) {
        setOpenUserMenu(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openUserMenu])

  const checkAuthAndFetchUsers = async () => {
    try {
      setIsLoading(true)
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/login')
        return
      }
      
      await Promise.all([fetchUsers(), fetchPositions(), fetchUserPositions()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPositions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return
      }

      const response = await fetch('/api/positions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPositions(data.positions || [])
      }
    } catch (err) {
      console.error('Failed to fetch positions:', err)
    }
  }

  const fetchUserPositions = async (): Promise<User[]> => {
    return new Promise(async (resolve) => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          resolve(users)
          return
        }

        const response = await fetch('/api/user-positions', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          setUserPositions(data.assignments || [])
          
          // Merge positions with users using callback to get latest state
          setUsers(prevUsers => {
            const updatedUsers = prevUsers.map(user => ({
              ...user,
              positions: (data.assignments || []).filter(
                (up: UserPosition) => up.user_id === user.id && up.position
              ).map((up: UserPosition) => up.position!)
            }))
            resolve(updatedUsers)
            return updatedUsers
          })
        } else {
          resolve(users)
        }
      } catch (err) {
        console.error('Failed to fetch user positions:', err)
        resolve(users)
      }
    })
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createFormData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create user')
      }

      await Promise.all([fetchUsers(), fetchUserPositions()])
      setShowCreateForm(false)
      setCreateFormData({ name: '', email: '', role: 'staff', password: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Update user data
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name,
          email: editFormData.email,
          role: editFormData.role,
          hourly_rate: editFormData.hourly_rate ? parseFloat(editFormData.hourly_rate.toString()) : null,
          employment_type: editFormData.employment_type || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update user')
      }

      // Update vacation balance if vacation_days is provided
      if (editFormData.vacation_days !== '') {
        const currentYear = new Date().getFullYear()
        const vacationDays = parseFloat(editFormData.vacation_days.toString())
        
        if (!isNaN(vacationDays) && vacationDays >= 0) {
          const balanceResponse = await fetch('/api/vacation/balances', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: editingUser.id,
              year: currentYear,
              total_days: vacationDays
            }),
          })

          if (!balanceResponse.ok) {
            console.error('Failed to update vacation balance')
          }
        }
      }

      await Promise.all([fetchUsers(), fetchUserPositions()])
      setShowEditDialog(false)
      setEditingUser(null)
      setCurrentVacationBalance(null)
      setEditFormData({
        name: '',
        email: '',
        role: 'staff',
        hourly_rate: '',
        employment_type: '',
        vacation_days: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  const handleAssignPosition = async (userId: string, positionId: string) => {
    if (isAssigningPosition) return
    
    setIsAssigningPosition(true)
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

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
        // If position is already assigned, treat it as success and just refresh
        if (errorData.error?.message?.includes('already assigned') || 
            errorData.error?.message?.includes('already exists') ||
            errorData.error?.message?.includes('unique constraint')) {
          // Position is already assigned, refresh data
          const updatedUsers = await fetchUserPositions()
          const updatedUser = updatedUsers.find(u => u.id === userId)
          if (updatedUser) {
            setManagingPositionsUser(updatedUser)
          }
          return // Exit successfully
        }
        throw new Error(errorData.error?.message || 'Fehler beim Zuweisen der Position')
      }

      // Refresh user positions and get fresh data
      const updatedUsers = await fetchUserPositions()
      const updatedUser = updatedUsers.find(u => u.id === userId)
      if (updatedUser) {
        setManagingPositionsUser(updatedUser)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Zuweisen der Position')
    } finally {
      setIsAssigningPosition(false)
    }
  }

  const handleRemovePosition = async (userId: string, positionId: string) => {
    if (isRemovingPosition === positionId) return
    
    setIsRemovingPosition(positionId)
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/user-positions?user_id=${userId}&position_id=${positionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Fehler beim Entfernen der Position')
      }

      // Refresh user positions and get fresh data
      const updatedUsers = await fetchUserPositions()
      const updatedUser = updatedUsers.find(u => u.id === userId)
      if (updatedUser) {
        setManagingPositionsUser(updatedUser)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Entfernen der Position')
    } finally {
      setIsRemovingPosition(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete user')
      }

      await fetchUsers()
      setShowDeleteDialog(false)
      setDeletingUser(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleResetPassword = async () => {
    if (!resettingUser || !newPassword) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/users/${resettingUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword: newPassword }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to reset password')
      }

      setShowResetPasswordDialog(false)
      setResettingUser(null)
      setNewPassword('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-gray-900 text-white'
      case 'manager':
        return 'bg-gray-600 text-white'
      case 'staff':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return 'Never'
    return new Date(lastLogin).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEmploymentTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      'mini': 'Mini',
      'teilzeit': 'Teilzeit',
      'vollzeit': 'Vollzeit',
      'werkstudent': 'Werkstudent'
    }
    return labels[type || ''] || type
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading users...</span>
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
                <h1 className="text-xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-600 mt-1">Manage team members and permissions</p>
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden xs:inline">Add User</span>
                </button>
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => router.push('/dashboard/settings')}
                    className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
                  >
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
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add User</span>
                </button>
                
                <button 
                  onClick={() => router.push('/dashboard/settings')}
                  className="bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
                >
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
        {/* Title - Full Width */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage your team members and their permissions</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white rounded-2xl flat-shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Team Members ({users.length})</h2>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {users.map((user) => (
              <div key={user.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="text-sm font-medium text-gray-900">{user.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {user.employment_type && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getEmploymentTypeLabel(user.employment_type)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-500">
                          Last login: {formatLastLogin(user.last_login)}
                        </span>
                        {user.hourly_rate !== null && (
                          <span className="text-xs text-gray-500">
                            Stundenlohn: {user.hourly_rate.toFixed(2)} €/h
                          </span>
                        )}
                        {user.employment_type && (
                          <span className="text-xs text-gray-500">
                            Lohnart: {getEmploymentTypeLabel(user.employment_type)}
                          </span>
                        )}
                      </div>
                      {/* User Positions */}
                      <div className="mt-2">
                        {user.positions && user.positions.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {user.positions.map((position) => (
                              <span
                                key={position.id}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
                                style={{ 
                                  backgroundColor: position.color || '#6b7280',
                                  borderColor: position.color || '#6b7280'
                                }}
                                title={position.description || position.name}
                              >
                                {position.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Keine Positionen zugewiesen</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setDeletingUser(user)
                        setShowDeleteDialog(true)
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete User"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    
                    <div className="relative">
                      <button
                        onClick={() => setOpenUserMenu(openUserMenu === user.id ? null : user.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="User Options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      
                      {openUserMenu === user.id && (
                        <div className="absolute right-0 top-10 bg-white rounded-xl flat-shadow-lg border border-gray-200 py-2 z-50 min-w-[180px]">
                          <button
                            onClick={async () => {
                              setEditingUser(user)
                              setEditFormData({
                                name: user.name,
                                email: user.email,
                                role: user.role,
                                hourly_rate: user.hourly_rate?.toString() || '',
                                employment_type: user.employment_type || '',
                                vacation_days: ''
                              })
                              
                              // Load vacation balance for current year
                              try {
                                const { data: { session } } = await supabase.auth.getSession()
                                if (session) {
                                  const currentYear = new Date().getFullYear()
                                  const balanceResponse = await fetch(
                                    `/api/vacation/balances?user_id=${user.id}&year=${currentYear}`,
                                    {
                                      headers: {
                                        'Authorization': `Bearer ${session.access_token}`
                                      }
                                    }
                                  )
                                  if (balanceResponse.ok) {
                                    const balanceData = await balanceResponse.json()
                                    const balance = balanceData.balances?.[0]
                                    if (balance) {
                                      setCurrentVacationBalance(balance)
                                      setEditFormData(prev => ({
                                        ...prev,
                                        vacation_days: balance.total_days.toString()
                                      }))
                                    } else {
                                      setCurrentVacationBalance(null)
                                    }
                                  }
                                }
                              } catch (err) {
                                console.error('Failed to fetch vacation balance:', err)
                                setCurrentVacationBalance(null)
                              }
                              
                              setShowEditDialog(true)
                              setOpenUserMenu(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Edit className="h-4 w-4" />
                            <span>Edit User</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setResettingUser(user)
                              setNewPassword('')
                              setShowResetPasswordDialog(true)
                              setOpenUserMenu(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Key className="h-4 w-4" />
                            <span>Reset Password</span>
                          </button>
                          
                          <button
                            onClick={async () => {
                              setOpenUserMenu(null)
                              // Refresh user positions before opening dialog
                              const updatedUsers = await fetchUserPositions()
                              // Find user with latest positions
                              const updatedUser = updatedUsers.find(u => u.id === user.id) || user
                              setManagingPositionsUser(updatedUser)
                              setShowPositionsDialog(true)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Briefcase className="h-4 w-4" />
                            <span>Positionen verwalten</span>
                          </button>
                          
                          <button
                            onClick={async () => {
                              try {
                                const { data: { session } } = await supabase.auth.getSession()
                                if (!session) return

                                const response = await fetch(`/api/users/${user.id}`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ is_active: !user.is_active }),
                                })

                                if (response.ok) {
                                  await fetchUsers()
                                }
                              } catch (err) {
                                setError('Failed to toggle user status')
                              }
                              setOpenUserMenu(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            {user.is_active ? (
                              <>
                                <UserX className="h-4 w-4" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl flat-shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add New User</h3>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={createFormData.role}
                  onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value as 'owner' | 'manager' | 'staff' })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditDialog && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl flat-shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
            </div>
            
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as 'owner' | 'manager' | 'staff' })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stundenlohn (€/h)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.hourly_rate}
                  onChange={(e) => setEditFormData({ ...editFormData, hourly_rate: e.target.value })}
                  placeholder="z.B. 15,50"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lohnart</label>
                <select
                  value={editFormData.employment_type || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, employment_type: e.target.value as 'mini' | 'teilzeit' | 'vollzeit' | 'werkstudent' | '' })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                >
                  <option value="">Nicht festgelegt</option>
                  <option value="mini">Mini (Minijob)</option>
                  <option value="teilzeit">Teilzeit</option>
                  <option value="vollzeit">Vollzeit</option>
                  <option value="werkstudent">Werkstudent</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Urlaubstage {new Date().getFullYear()}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editFormData.vacation_days}
                  onChange={(e) => setEditFormData({ ...editFormData, vacation_days: e.target.value })}
                  placeholder="z.B. 25"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                />
                {currentVacationBalance && (
                  <div className="mt-2 text-xs text-gray-500">
                    Genutzt: {currentVacationBalance.used_days} Tage | 
                    Verbleibend: {currentVacationBalance.remaining_days} Tage
                  </div>
                )}
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingUser(null)
                    setCurrentVacationBalance(null)
                    setEditFormData({
                      name: '',
                      email: '',
                      role: 'staff',
                      hourly_rate: '',
                      employment_type: '',
                      vacation_days: ''
                    })
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteDialog && deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl flat-shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Delete User</h3>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{deletingUser.name}</strong>? This action cannot be undone.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordDialog && resettingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl flat-shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
              <p className="text-sm text-gray-600 mt-1">Set a new password for {resettingUser.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  placeholder="Enter new password"
                  required
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowResetPasswordDialog(false)
                    setResettingUser(null)
                    setNewPassword('')
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={!newPassword}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Positions Modal */}
      {showPositionsDialog && managingPositionsUser && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          onClick={() => {
            setShowPositionsDialog(false)
            setManagingPositionsUser(null)
          }}
        >
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
                    <p className="text-sm text-gray-600 mt-0.5">{managingPositionsUser.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPositionsDialog(false)
                    setManagingPositionsUser(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Current Positions */}
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  <span>Aktuelle Positionen</span>
                  {managingPositionsUser.positions && managingPositionsUser.positions.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {managingPositionsUser.positions.length}
                    </span>
                  )}
                </h4>
                {managingPositionsUser.positions && managingPositionsUser.positions.length > 0 ? (
                  <div className="space-y-2">
                    {managingPositionsUser.positions.map((position) => (
                      <div
                        key={position.id}
                        className="group relative px-4 py-3 rounded-xl border-2 transition-all duration-200"
                        style={{ 
                          borderColor: position.color || '#e5e7eb',
                          backgroundColor: `${position.color || '#6b7280'}15`
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg"
                              style={{ backgroundColor: position.color || '#6b7280' }}
                            >
                              {position.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900">{position.name}</div>
                              {position.description && (
                                <div className="text-xs text-gray-600 mt-0.5 truncate">{position.description}</div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemovePosition(managingPositionsUser.id, position.id)}
                            disabled={isRemovingPosition === position.id}
                            className="ml-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Position entfernen"
                          >
                            {isRemovingPosition === position.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">Keine Positionen zugewiesen</p>
                    <p className="text-xs text-gray-400 mt-1">Wähle Positionen aus der Liste unten aus</p>
                  </div>
                )}
              </div>

              {/* Available Positions */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  <span>Verfügbare Positionen</span>
                </h4>
                {positions.filter(p => 
                  p.is_active && 
                  !managingPositionsUser.positions?.some(up => up.id === p.id)
                ).length > 0 ? (
                  <div className="space-y-2">
                    {positions
                      .filter(p => 
                        p.is_active && 
                        !managingPositionsUser.positions?.some(up => up.id === p.id)
                      )
                      .map((position) => (
                        <button
                          key={position.id}
                          onClick={() => handleAssignPosition(managingPositionsUser.id, position.id)}
                          disabled={isAssigningPosition}
                          className="w-full text-left px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 flex items-center space-x-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md transition-transform group-hover:scale-110"
                            style={{ backgroundColor: position.color || '#6b7280' }}
                          >
                            {position.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{position.name}</div>
                            {position.description && (
                              <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{position.description}</div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-green-100 flex items-center justify-center transition-colors">
                              {isAssigningPosition ? (
                                <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                              ) : (
                                <Plus className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Check className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">Alle Positionen zugewiesen</p>
                    <p className="text-xs text-gray-400 mt-1">Dieser Mitarbeiter hat bereits alle verfügbaren Positionen</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowPositionsDialog(false)
                    setManagingPositionsUser(null)
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => {
                    setShowPositionsDialog(false)
                    setManagingPositionsUser(null)
                  }}
                  className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors shadow-sm"
                >
                  Fertig
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
