'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Plus, 
  Package, 
  Edit,
  Trash2,
  ArrowLeft,
  Settings,
  LogOut,
  Loader2,
  X,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Filter
} from 'lucide-react'

interface InventoryItem {
  id: string
  name: string
  category: string | null
  description: string | null
  current_stock: number
  unit: string
  reorder_point: number
  reorder_quantity: number
  cost_per_unit: number
  cost_per_unit_netto: number | null
  cost_per_unit_brutto: number | null
  vat_rate: number | null
  supplier: string | null
  supplier_id: string | null
  supplier_contact: any
  is_active: boolean
  created_at: string
  updated_at: string
  suppliers?: {
    id: string
    name: string
  }
}

interface Supplier {
  id: string
  name: string
}

interface InventoryMovement {
  id: string
  item_id: string
  movement_type: 'in' | 'out' | 'adjustment' | 'waste' | 'transfer'
  quantity: number
  unit_cost: number | null
  total_cost: number | null
  reason: string | null
  reference_number: string | null
  movement_date: string
  inventory_items?: {
    id: string
    name: string
    unit: string
  }
  users?: {
    id: string
    name: string
  }
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [showEditMovementDialog, setShowEditMovementDialog] = useState(false)
  const [showDeleteMovementDialog, setShowDeleteMovementDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null)
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null)
  const [editingMovement, setEditingMovement] = useState<InventoryMovement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<InventoryMovement | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [unlinkedItems, setUnlinkedItems] = useState<Array<{
    product_name: string
    total_quantity: number
    total_revenue: number
    avg_unit_price: number
    transaction_count: number
    first_seen: string
    last_seen: string
    transaction_item_ids: string[]
  }>>([])
  const [isLoadingUnlinked, setIsLoadingUnlinked] = useState(false)
  const [isCreatingProduct, setIsCreatingProduct] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'inventory' | 'unlinked'>('inventory')
  const [createFormData, setCreateFormData] = useState({
    name: '',
    category: '',
    description: '',
    current_stock: '',
    unit: '',
    reorder_point: '',
    reorder_quantity: '',
    cost_per_unit_netto: '',
    cost_per_unit_brutto: '',
    vat_rate: '19.0',
    supplier_id: ''
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: '',
    description: '',
    current_stock: '',
    unit: '',
    reorder_point: '',
    reorder_quantity: '',
    cost_per_unit_netto: '',
    cost_per_unit_brutto: '',
    vat_rate: '19.0',
    supplier_id: '',
    is_active: true
  })
  const [costInputMode, setCostInputMode] = useState<'netto' | 'brutto'>('brutto')
  const [movementFormData, setMovementFormData] = useState({
    movement_type: 'in' as 'in' | 'out' | 'adjustment' | 'waste' | 'transfer',
    quantity: '',
    unit_cost: '',
    reason: '',
    reference_number: '',
    movement_date: ''
  })
  const [editMovementFormData, setEditMovementFormData] = useState({
    movement_type: 'in' as 'in' | 'out' | 'adjustment' | 'waste' | 'transfer',
    quantity: '',
    unit_cost: '',
    reason: '',
    reference_number: '',
    movement_date: ''
  })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    checkAuthAndFetchData()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      fetchItems()
    }
  }, [selectedCategory, showLowStockOnly])

  const checkAuthAndFetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/login')
        return
      }
      
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
      
      await Promise.all([fetchItems(), fetchMovements(), fetchSuppliers(), fetchUnlinkedItems()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setIsLoading(false)
    }
  }

  const fetchUnlinkedItems = async () => {
    try {
      setIsLoadingUnlinked(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/transaction-items/unlinked', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || 'Failed to fetch unlinked items')
      }
      
      setUnlinkedItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch unlinked items:', err)
      // Don't show error to user, just log it
    } finally {
      setIsLoadingUnlinked(false)
    }
  }

  const handleCreateProductFromUnlinked = async (item: typeof unlinkedItems[0]) => {
    try {
      setIsCreatingProduct(item.product_name)
      setError(null)
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Calculate VAT rate from average price
      // Assume 19% if we can't determine
      const vatRate = 19.0
      const priceBrutto = item.avg_unit_price
      const priceNetto = priceBrutto / (1 + vatRate / 100)

      const response = await fetch('/api/transaction-items/create-product-and-link', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_name: item.product_name,
          price_brutto: priceBrutto,
          price_netto: priceNetto,
          vat_rate: vatRate,
          is_direct_sale: false, // Default to false, user can change later
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create product')
      }

      // Refresh unlinked items and products
      await Promise.all([fetchUnlinkedItems(), fetchItems()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setIsCreatingProduct(null)
    }
  }

  const fetchItems = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      let url = '/api/inventory?include_inactive=true'
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`
      }
      if (showLowStockOnly) {
        url += '&low_stock=true'
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || 'Failed to fetch inventory items')
      }
      
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory items')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMovements = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return
      }

      const response = await fetch('/api/inventory/movements?limit=50', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        console.error('Failed to fetch movements:', data.error)
        return
      }
      
      setMovements(data.movements || [])
    } catch (err) {
      console.error('Failed to fetch movements:', err)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return
      }

      const response = await fetch('/api/suppliers?include_inactive=true', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        console.error('Failed to fetch suppliers:', data.error)
        return
      }
      
      setSuppliers(data.suppliers || [])
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
    }
  }

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createFormData.name,
          category: createFormData.category || null,
          description: createFormData.description || null,
          current_stock: parseFloat(createFormData.current_stock) || 0,
          unit: createFormData.unit,
          reorder_point: parseFloat(createFormData.reorder_point) || 0,
          reorder_quantity: parseFloat(createFormData.reorder_quantity) || 0,
          cost_per_unit_netto: createFormData.cost_per_unit_netto ? parseFloat(createFormData.cost_per_unit_netto) : null,
          cost_per_unit_brutto: createFormData.cost_per_unit_brutto ? parseFloat(createFormData.cost_per_unit_brutto) : null,
          vat_rate: parseFloat(createFormData.vat_rate) || 19.0,
          supplier_id: createFormData.supplier_id || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create inventory item')
      }

      await Promise.all([fetchItems(), fetchSuppliers()])
      setShowCreateForm(false)
      setCreateFormData({
        name: '',
        category: '',
        description: '',
        current_stock: '',
        unit: '',
        reorder_point: '',
        reorder_quantity: '',
        cost_per_unit_netto: '',
        cost_per_unit_brutto: '',
        vat_rate: '19.0',
        supplier_id: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inventory item')
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    setIsUpdating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name,
          category: editFormData.category || null,
          description: editFormData.description || null,
          current_stock: parseFloat(editFormData.current_stock),
          unit: editFormData.unit,
          reorder_point: parseFloat(editFormData.reorder_point) || 0,
          reorder_quantity: parseFloat(editFormData.reorder_quantity) || 0,
          cost_per_unit_netto: editFormData.cost_per_unit_netto ? parseFloat(editFormData.cost_per_unit_netto) : null,
          cost_per_unit_brutto: editFormData.cost_per_unit_brutto ? parseFloat(editFormData.cost_per_unit_brutto) : null,
          vat_rate: parseFloat(editFormData.vat_rate) || 19.0,
          supplier_id: editFormData.supplier_id || null,
          is_active: editFormData.is_active
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update inventory item')
      }

      await Promise.all([fetchItems(), fetchSuppliers()])
      setShowEditDialog(false)
      setEditingItem(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory item')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!deletingItem) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/inventory/${deletingItem.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete inventory item')
      }

      await fetchItems()
      setShowDeleteDialog(false)
      setDeletingItem(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inventory item')
    }
  }

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!movementItem) return

    setIsCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item_id: movementItem.id,
          movement_type: movementFormData.movement_type,
          quantity: parseFloat(movementFormData.quantity),
          unit_cost: movementFormData.unit_cost ? parseFloat(movementFormData.unit_cost) : null,
          reason: movementFormData.reason || null,
          reference_number: movementFormData.reference_number || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create inventory movement')
      }

      await Promise.all([fetchItems(), fetchMovements()])
      setShowMovementDialog(false)
      setMovementItem(null)
      setMovementFormData({
        movement_type: 'in',
        quantity: '',
        unit_cost: '',
        reason: '',
        reference_number: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inventory movement')
    } finally {
      setIsCreating(false)
    }
  }

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item)
    setEditFormData({
      name: item.name,
      category: item.category || '',
      description: item.description || '',
      current_stock: item.current_stock.toString(),
      unit: item.unit,
      reorder_point: item.reorder_point.toString(),
      reorder_quantity: item.reorder_quantity.toString(),
      cost_per_unit_netto: (item.cost_per_unit_netto || item.cost_per_unit / (1 + (item.vat_rate || 19.0) / 100)).toString(),
      cost_per_unit_brutto: (item.cost_per_unit_brutto || item.cost_per_unit).toString(),
      vat_rate: (item.vat_rate || 19.0).toString(),
      supplier_id: item.supplier_id || '',
      is_active: item.is_active
    })
    setCostInputMode(item.cost_per_unit_brutto ? 'brutto' : 'netto')
    setShowEditDialog(true)
  }

  const openMovementDialog = (item: InventoryItem) => {
    setMovementItem(item)
    setMovementFormData({
      movement_type: 'in',
      quantity: '',
      unit_cost: (item.cost_per_unit_brutto || item.cost_per_unit).toString(),
      reason: '',
      reference_number: '',
      movement_date: ''
    })
    setShowMovementDialog(true)
  }

  const openEditMovementDialog = (movement: InventoryMovement) => {
    setEditingMovement(movement)
    setEditMovementFormData({
      movement_type: movement.movement_type,
      quantity: movement.quantity.toString(),
      unit_cost: movement.unit_cost?.toString() || '',
      reason: movement.reason || '',
      reference_number: movement.reference_number || '',
      movement_date: movement.movement_date ? new Date(movement.movement_date).toISOString().slice(0, 16) : ''
    })
    setShowEditMovementDialog(true)
  }

  const handleEditMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMovement) return

    setIsUpdating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/inventory/movements/${editingMovement.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movement_type: editMovementFormData.movement_type,
          quantity: parseFloat(editMovementFormData.quantity),
          unit_cost: editMovementFormData.unit_cost ? parseFloat(editMovementFormData.unit_cost) : null,
          reason: editMovementFormData.reason || null,
          reference_number: editMovementFormData.reference_number || null,
          movement_date: editMovementFormData.movement_date || undefined
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update inventory movement')
      }

      await Promise.all([fetchItems(), fetchMovements()])
      setShowEditMovementDialog(false)
      setEditingMovement(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory movement')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteMovement = async () => {
    if (!deletingMovement) return

    setIsUpdating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/inventory/movements/${deletingMovement.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete inventory movement')
      }

      await Promise.all([fetchItems(), fetchMovements()])
      setShowDeleteMovementDialog(false)
      setDeletingMovement(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inventory movement')
    } finally {
      setIsUpdating(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const getStockStatus = (item: InventoryItem) => {
    if (item.current_stock <= 0) {
      return { color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle, label: 'Ausverkauft' }
    }
    if (item.current_stock <= item.reorder_point) {
      return { color: 'text-orange-600', bg: 'bg-orange-50', icon: TrendingDown, label: 'Niedrig' }
    }
    return { color: 'text-green-600', bg: 'bg-green-50', icon: TrendingUp, label: 'OK' }
  }

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'in': 'Eingang',
      'out': 'Ausgang',
      'adjustment': 'Korrektur',
      'waste': 'Ausschuss',
      'transfer': 'Transfer'
    }
    return labels[type] || type
  }

  const getMovementTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'in': 'bg-green-100 text-green-800',
      'out': 'bg-red-100 text-red-800',
      'adjustment': 'bg-blue-100 text-blue-800',
      'waste': 'bg-orange-100 text-orange-800',
      'transfer': 'bg-purple-100 text-purple-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const categories = Array.from(new Set(items.map(item => item.category).filter(Boolean))) as string[]
  
  // Sort items by category, then by name
  const sortedItems = [...items].sort((a, b) => {
    // First sort by category (null/undefined categories go last)
    const categoryA = a.category || 'ZZZ_NO_CATEGORY'
    const categoryB = b.category || 'ZZZ_NO_CATEGORY'
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB, 'de')
    }
    // Then sort by name within the same category
    return a.name.localeCompare(b.name, 'de')
  })
  
  // Group items by category
  const itemsByCategory = sortedItems.reduce((acc, item) => {
    const category = item.category || 'Ohne Kategorie'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, typeof items>)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Lade Inventar...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Inventar</h1>
                <p className="text-sm text-gray-600 mt-1">Verwaltung von Lagerbeständen</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setError(null)
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Neues Item</span>
              </button>
              <button
                onClick={fetchItems}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Aktualisieren"
              >
                <RefreshCw className="h-5 w-5 text-gray-600" />
              </button>
              <Link href="/dashboard/settings">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings className="h-5 w-5 text-gray-600" />
                </button>
              </Link>
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

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inventory'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inventar
            </button>
            <button
              onClick={() => {
                setActiveTab('unlinked')
                if (unlinkedItems.length === 0) {
                  fetchUnlinkedItems()
                }
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'unlinked'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Nicht-verknüpfte Artikel
              {unlinkedItems.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {unlinkedItems.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Inventory Tab Content */}
        {activeTab === 'inventory' && (
          <>
            {/* Filters */}
            <div className="mb-6 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-500" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Alle Kategorien</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Nur niedrige Bestände</span>
              </label>
            </div>

        {/* Inventory Items Grid - Grouped by Category */}
        {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{category}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {categoryItems.map((item) => {
            const stockStatus = getStockStatus(item)
            const StatusIcon = stockStatus.icon
            return (
              <div
                key={item.id}
                className={`bg-white rounded-lg shadow-sm p-3 border-2 ${
                  item.is_active ? 'border-gray-200' : 'border-gray-300 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                    {item.category && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{item.category}</p>
                    )}
                  </div>
                  <div className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center space-x-0.5 ml-1 ${stockStatus.bg} ${stockStatus.color}`}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">{stockStatus.label}</span>
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                )}

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Bestand:</span>
                    <span className="text-xs font-semibold text-gray-900">
                      {item.current_stock} {item.unit}
                    </span>
                  </div>
                  {item.reorder_point > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Nachbestell:</span>
                      <span className="text-xs text-gray-900">{item.reorder_point} {item.unit}</span>
                    </div>
                  )}
                  {(item.cost_per_unit_brutto || item.cost_per_unit) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Kosten:</span>
                      <span className="text-xs text-gray-900">{formatCurrency(item.cost_per_unit_brutto || item.cost_per_unit)}</span>
                    </div>
                  )}
                  {item.suppliers && item.suppliers.name && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Lieferant:</span>
                      <span className="text-xs text-gray-900 truncate ml-1">{item.suppliers.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-1 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => openMovementDialog(item)}
                    className="flex-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    Bewegung
                  </button>
                  <button
                    onClick={() => openEditDialog(item)}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Bearbeiten"
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => {
                      setDeletingItem(item)
                      setShowDeleteDialog(true)
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Noch keine Inventar-Items vorhanden</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Erstes Item erstellen
            </button>
          </div>
        )}

        {/* Recent Movements */}
        {movements.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Letzte Bewegungen</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Datum
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Typ
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Menge
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kosten
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grund
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(movement.movement_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {movement.inventory_items?.name || 'Unbekannt'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMovementTypeColor(movement.movement_type)}`}>
                            {getMovementTypeLabel(movement.movement_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {movement.quantity} {movement.inventory_items?.unit || ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {movement.total_cost ? formatCurrency(movement.total_cost) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {movement.reason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditMovementDialog(movement)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Bearbeiten"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingMovement(movement)
                                setShowDeleteMovementDialog(true)
                              }}
                              className="text-red-600 hover:text-red-900"
                              title="Löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {/* Unlinked Items Tab Content */}
        {activeTab === 'unlinked' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Nicht-verknüpfte Artikel</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Artikel aus Transaktionen, die noch keinem Produkt zugeordnet sind
                </p>
              </div>
              <button
                onClick={fetchUnlinkedItems}
                disabled={isLoadingUnlinked}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Aktualisieren"
              >
                <RefreshCw className={`h-5 w-5 text-gray-600 ${isLoadingUnlinked ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingUnlinked ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600">Lade nicht-verknüpfte Artikel...</p>
              </div>
            ) : unlinkedItems.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Keine nicht-verknüpften Artikel gefunden</p>
                <p className="text-sm text-gray-500 mt-2">Alle Artikel aus Transaktionen sind bereits Produkten zugeordnet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Artikelname
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaktionen
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gesamtmenge
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gesamtumsatz
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ø Preis
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aktion
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {unlinkedItems.map((item) => (
                        <tr key={item.product_name} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {item.product_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Erste: {new Date(item.first_seen).toLocaleDateString('de-DE')} | 
                              Letzte: {new Date(item.last_seen).toLocaleDateString('de-DE')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                            {item.transaction_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                            {item.total_quantity.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                            {formatCurrency(item.total_revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                            {formatCurrency(item.avg_unit_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleCreateProductFromUnlinked(item)}
                              disabled={isCreatingProduct === item.product_name}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isCreatingProduct === item.product_name ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Wird erstellt...
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Produkt anlegen
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Form Dialog */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Neues Inventar-Item</h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setError(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie
                  </label>
                  <input
                    type="text"
                    value={createFormData.category}
                    onChange={(e) => setCreateFormData({ ...createFormData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einheit *
                  </label>
                  <input
                    type="text"
                    value={createFormData.unit}
                    onChange={(e) => setCreateFormData({ ...createFormData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="z.B. kg, Stück, Liter"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aktueller Bestand
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={createFormData.current_stock}
                    onChange={(e) => setCreateFormData({ ...createFormData, current_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nachbestellpunkt
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={createFormData.reorder_point}
                    onChange={(e) => setCreateFormData({ ...createFormData, reorder_point: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nachbestellmenge
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={createFormData.reorder_quantity}
                  onChange={(e) => setCreateFormData({ ...createFormData, reorder_quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kosten-Eingabe
                </label>
                <div className="flex items-center space-x-4 mb-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="createCostMode"
                      checked={costInputMode === 'brutto'}
                      onChange={() => setCostInputMode('brutto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Brutto (inkl. MwSt)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="createCostMode"
                      checked={costInputMode === 'netto'}
                      onChange={() => setCostInputMode('netto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Netto (exkl. MwSt)</span>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {costInputMode === 'brutto' ? (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kosten pro Einheit Brutto (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={createFormData.cost_per_unit_brutto}
                        onChange={(e) => {
                          const brutto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(createFormData.vat_rate) || 19.0
                          const netto = brutto / (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            cost_per_unit_brutto: e.target.value,
                            cost_per_unit_netto: netto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kosten pro Einheit Netto (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={createFormData.cost_per_unit_netto}
                        onChange={(e) => {
                          const netto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(createFormData.vat_rate) || 19.0
                          const brutto = netto * (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            cost_per_unit_netto: e.target.value,
                            cost_per_unit_brutto: brutto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      MwSt (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={createFormData.vat_rate}
                      onChange={(e) => {
                        const vatRate = parseFloat(e.target.value) || 19.0
                        let netto = parseFloat(createFormData.cost_per_unit_netto) || 0
                        let brutto = parseFloat(createFormData.cost_per_unit_brutto) || 0
                        
                        if (costInputMode === 'brutto' && brutto > 0) {
                          netto = brutto / (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            vat_rate: e.target.value,
                            cost_per_unit_netto: netto.toFixed(2)
                          })
                        } else if (costInputMode === 'netto' && netto > 0) {
                          brutto = netto * (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            vat_rate: e.target.value,
                            cost_per_unit_brutto: brutto.toFixed(2)
                          })
                        } else {
                          setCreateFormData({
                            ...createFormData,
                            vat_rate: e.target.value
                          })
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                {createFormData.cost_per_unit_brutto && createFormData.cost_per_unit_netto && (
                  <div className="mt-2 text-xs text-gray-500">
                    {costInputMode === 'brutto' ? (
                      <>Netto: {formatCurrency(parseFloat(createFormData.cost_per_unit_netto))}</>
                    ) : (
                      <>Brutto: {formatCurrency(parseFloat(createFormData.cost_per_unit_brutto))}</>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lieferant
                </label>
                <select
                  value={createFormData.supplier_id}
                  onChange={(e) => setCreateFormData({ ...createFormData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Kein Lieferant</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setError(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {showEditDialog && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Item bearbeiten</h2>
                <button
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingItem(null)
                    setError(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <form onSubmit={handleEditItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie
                  </label>
                  <input
                    type="text"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einheit *
                  </label>
                  <input
                    type="text"
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aktueller Bestand
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.current_stock}
                    onChange={(e) => setEditFormData({ ...editFormData, current_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nachbestellpunkt
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.reorder_point}
                    onChange={(e) => setEditFormData({ ...editFormData, reorder_point: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nachbestellmenge
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.reorder_quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, reorder_quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kosten-Eingabe
                </label>
                <div className="flex items-center space-x-4 mb-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="editCostMode"
                      checked={costInputMode === 'brutto'}
                      onChange={() => setCostInputMode('brutto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Brutto (inkl. MwSt)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="editCostMode"
                      checked={costInputMode === 'netto'}
                      onChange={() => setCostInputMode('netto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Netto (exkl. MwSt)</span>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {costInputMode === 'brutto' ? (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kosten pro Einheit Brutto (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.cost_per_unit_brutto}
                        onChange={(e) => {
                          const brutto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(editFormData.vat_rate) || 19.0
                          const netto = brutto / (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            cost_per_unit_brutto: e.target.value,
                            cost_per_unit_netto: netto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kosten pro Einheit Netto (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.cost_per_unit_netto}
                        onChange={(e) => {
                          const netto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(editFormData.vat_rate) || 19.0
                          const brutto = netto * (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            cost_per_unit_netto: e.target.value,
                            cost_per_unit_brutto: brutto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      MwSt (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editFormData.vat_rate}
                      onChange={(e) => {
                        const vatRate = parseFloat(e.target.value) || 19.0
                        let netto = parseFloat(editFormData.cost_per_unit_netto) || 0
                        let brutto = parseFloat(editFormData.cost_per_unit_brutto) || 0
                        
                        if (costInputMode === 'brutto' && brutto > 0) {
                          netto = brutto / (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            vat_rate: e.target.value,
                            cost_per_unit_netto: netto.toFixed(2)
                          })
                        } else if (costInputMode === 'netto' && netto > 0) {
                          brutto = netto * (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            vat_rate: e.target.value,
                            cost_per_unit_brutto: brutto.toFixed(2)
                          })
                        } else {
                          setEditFormData({
                            ...editFormData,
                            vat_rate: e.target.value
                          })
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                {editFormData.cost_per_unit_brutto && editFormData.cost_per_unit_netto && (
                  <div className="mt-2 text-xs text-gray-500">
                    {costInputMode === 'brutto' ? (
                      <>Netto: {formatCurrency(parseFloat(editFormData.cost_per_unit_netto))}</>
                    ) : (
                      <>Brutto: {formatCurrency(parseFloat(editFormData.cost_per_unit_brutto))}</>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lieferant
                </label>
                <select
                  value={editFormData.supplier_id}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Kein Lieferant</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Aktiv
                </label>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingItem(null)
                    setError(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && deletingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Item löschen?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Möchten Sie "{deletingItem.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeletingItem(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteItem}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement Dialog */}
      {showMovementDialog && movementItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Bestandsbewegung</h2>
                <button
                  onClick={() => {
                    setShowMovementDialog(false)
                    setMovementItem(null)
                    setError(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{movementItem.name}</p>
            </div>
            <form onSubmit={handleCreateMovement} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Typ *
                </label>
                <select
                  value={movementFormData.movement_type}
                  onChange={(e) => setMovementFormData({ ...movementFormData, movement_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="in">Eingang</option>
                  <option value="out">Ausgang</option>
                  <option value="adjustment">Korrektur</option>
                  <option value="waste">Ausschuss</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Menge ({movementItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={movementFormData.quantity}
                  onChange={(e) => setMovementFormData({ ...movementFormData, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kosten pro Einheit (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={movementFormData.unit_cost}
                  onChange={(e) => setMovementFormData({ ...movementFormData, unit_cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grund
                </label>
                <input
                  type="text"
                  value={movementFormData.reason}
                  onChange={(e) => setMovementFormData({ ...movementFormData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referenznummer
                </label>
                <input
                  type="text"
                  value={movementFormData.reference_number}
                  onChange={(e) => setMovementFormData({ ...movementFormData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMovementDialog(false)
                    setMovementItem(null)
                    setError(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Movement Dialog */}
      {showEditMovementDialog && editingMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Bewegung bearbeiten</h2>
                <button
                  onClick={() => {
                    setShowEditMovementDialog(false)
                    setEditingMovement(null)
                    setError(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{editingMovement.inventory_items?.name || 'Unbekannt'}</p>
            </div>
            <form onSubmit={handleEditMovement} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Typ *
                </label>
                <select
                  value={editMovementFormData.movement_type}
                  onChange={(e) => setEditMovementFormData({ ...editMovementFormData, movement_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="in">Eingang</option>
                  <option value="out">Ausgang</option>
                  <option value="adjustment">Korrektur</option>
                  <option value="waste">Ausschuss</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Menge ({editingMovement.inventory_items?.unit || ''}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editMovementFormData.quantity}
                  onChange={(e) => setEditMovementFormData({ ...editMovementFormData, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kosten pro Einheit (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editMovementFormData.unit_cost}
                  onChange={(e) => setEditMovementFormData({ ...editMovementFormData, unit_cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grund
                </label>
                <input
                  type="text"
                  value={editMovementFormData.reason}
                  onChange={(e) => setEditMovementFormData({ ...editMovementFormData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referenznummer
                </label>
                <input
                  type="text"
                  value={editMovementFormData.reference_number}
                  onChange={(e) => setEditMovementFormData({ ...editMovementFormData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum & Zeit
                </label>
                <input
                  type="datetime-local"
                  value={editMovementFormData.movement_date}
                  onChange={(e) => setEditMovementFormData({ ...editMovementFormData, movement_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditMovementDialog(false)
                    setEditingMovement(null)
                    setError(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Movement Dialog */}
      {showDeleteMovementDialog && deletingMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Bewegung löschen?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Möchten Sie diese Bewegung wirklich löschen? Der Bestand wird entsprechend angepasst. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteMovementDialog(false)
                    setDeletingMovement(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteMovement}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

