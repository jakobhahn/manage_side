'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Plus, 
  ShoppingBag, 
  Edit,
  Trash2,
  ArrowLeft,
  Settings,
  LogOut,
  Loader2,
  X,
  RefreshCw,
  Filter,
  ChefHat,
  Package,
  Link as LinkIcon
} from 'lucide-react'

interface Product {
  id: string
  name: string
  description: string | null
  category: string | null
  price: number
  price_netto: number | null
  price_brutto: number | null
  vat_rate: number | null
  cost: number
  sku: string | null
  barcode: string | null
  is_active: boolean
  is_direct_sale: boolean
  inventory_item_id: string | null
  inventory_items?: {
    id: string
    name: string
    unit: string
    current_stock: number
    cost_per_unit: number
  }
  product_recipes?: Array<{
    id: string
    inventory_item_id: string
    quantity: number
    unit: string
    notes: string | null
    inventory_items: {
      id: string
      name: string
      unit: string
      current_stock: number
      cost_per_unit: number
    }
  }>
}

interface InventoryItem {
  id: string
  name: string
  unit: string
  current_stock: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRecipeDialog, setShowRecipeDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    category: '',
    price_netto: '',
    price_brutto: '',
    vat_rate: '19.0',
    sku: '',
    barcode: '',
    is_direct_sale: false,
    inventory_item_id: ''
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    category: '',
    price_netto: '',
    price_brutto: '',
    vat_rate: '19.0',
    sku: '',
    barcode: '',
    is_direct_sale: false,
    inventory_item_id: '',
    is_active: true
  })
  const [priceInputMode, setPriceInputMode] = useState<'netto' | 'brutto'>('brutto')
  const [recipeFormData, setRecipeFormData] = useState({
    inventory_item_id: '',
    quantity: '',
    unit: '',
    notes: ''
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
      fetchProducts()
    }
  }, [selectedCategory])

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
      
      await Promise.all([fetchProducts(), fetchInventoryItems()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setIsLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      let url = '/api/products?include_recipes=true&include_inactive=true'
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || 'Failed to fetch products')
      }
      
      setProducts(data.products || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInventoryItems = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return
      }

      const response = await fetch('/api/inventory?include_inactive=true', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.error) {
        console.error('Failed to fetch inventory items:', data.error)
        return
      }
      
      setInventoryItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch inventory items:', err)
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createFormData.name,
          description: createFormData.description || null,
          category: createFormData.category || null,
          price_netto: createFormData.price_netto ? parseFloat(createFormData.price_netto) : null,
          price_brutto: createFormData.price_brutto ? parseFloat(createFormData.price_brutto) : null,
          vat_rate: parseFloat(createFormData.vat_rate) || 19.0,
          sku: createFormData.sku || null,
          barcode: createFormData.barcode || null,
          is_direct_sale: createFormData.is_direct_sale,
          inventory_item_id: createFormData.is_direct_sale ? createFormData.inventory_item_id || null : null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create product')
      }

      await fetchProducts()
      setShowCreateForm(false)
      setCreateFormData({
        name: '',
        description: '',
        category: '',
        price_netto: '',
        price_brutto: '',
        vat_rate: '19.0',
        sku: '',
        barcode: '',
        is_direct_sale: false,
        inventory_item_id: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    setIsUpdating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name,
          description: editFormData.description || null,
          category: editFormData.category || null,
          price_netto: editFormData.price_netto ? parseFloat(editFormData.price_netto) : null,
          price_brutto: editFormData.price_brutto ? parseFloat(editFormData.price_brutto) : null,
          vat_rate: parseFloat(editFormData.vat_rate) || 19.0,
          sku: editFormData.sku || null,
          barcode: editFormData.barcode || null,
          is_direct_sale: editFormData.is_direct_sale,
          inventory_item_id: editFormData.is_direct_sale ? editFormData.inventory_item_id || null : null,
          is_active: editFormData.is_active
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update product')
      }

      await fetchProducts()
      setShowEditDialog(false)
      setEditingProduct(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/products/${deletingProduct.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete product')
      }

      await fetchProducts()
      setShowDeleteDialog(false)
      setDeletingProduct(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  const handleAddRecipeItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipeProduct) return

    setIsCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/products/${recipeProduct.id}/recipes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventory_item_id: recipeFormData.inventory_item_id,
          quantity: parseFloat(recipeFormData.quantity),
          unit: recipeFormData.unit,
          notes: recipeFormData.notes || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to add recipe item')
      }

      await fetchProducts()
      setRecipeFormData({
        inventory_item_id: '',
        quantity: '',
        unit: '',
        notes: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipe item')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteRecipeItem = async (recipeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/product-recipes/${recipeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to delete recipe item')
      }

      await fetchProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe item')
    }
  }

  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setEditFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      price_netto: product.price_netto?.toString() || '',
      price_brutto: product.price_brutto?.toString() || product.price.toString(),
      vat_rate: product.vat_rate?.toString() || '19.0',
      sku: product.sku || '',
      barcode: product.barcode || '',
      is_direct_sale: product.is_direct_sale,
      inventory_item_id: product.inventory_item_id || '',
      is_active: product.is_active
    })
    setShowEditDialog(true)
  }

  const openRecipeDialog = (product: Product) => {
    setRecipeProduct(product)
    setRecipeFormData({
      inventory_item_id: '',
      quantity: '',
      unit: '',
      notes: ''
    })
    setShowRecipeDialog(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[]
  
  // Sort products by category, then by name
  const sortedProducts = [...products].sort((a, b) => {
    // First sort by category (null/undefined categories go last)
    const categoryA = a.category || 'ZZZ_NO_CATEGORY'
    const categoryB = b.category || 'ZZZ_NO_CATEGORY'
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB, 'de')
    }
    // Then sort by name within the same category
    return a.name.localeCompare(b.name, 'de')
  })
  
  // Group products by category
  const productsByCategory = sortedProducts.reduce((acc, product) => {
    const category = product.category || 'Ohne Kategorie'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(product)
    return acc
  }, {} as Record<string, typeof products>)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Lade Produkte...</span>
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
                <h1 className="text-2xl font-bold text-gray-900">Produkte</h1>
                <p className="text-sm text-gray-600 mt-1">Verwaltung von Produkten und Rezepten</p>
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
                <span>Neues Produkt</span>
              </button>
              <button
                onClick={fetchProducts}
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
        </div>

        {/* Products Grid - Grouped by Category */}
        {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{category}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {categoryProducts.map((product) => (
            <div
              key={product.id}
              className={`bg-white rounded-lg shadow-sm p-3 border-2 ${
                product.is_active ? 'border-gray-200' : 'border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h3>
                  {product.category && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{product.category}</p>
                  )}
                </div>
                {!product.is_active && (
                  <span className="px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded ml-1">
                    Inaktiv
                  </span>
                )}
              </div>

              {product.description && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{product.description}</p>
              )}

              <div className="space-y-1 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Preis:</span>
                  <span className="text-xs font-semibold text-gray-900">
                    {formatCurrency(product.price_brutto || product.price)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Kosten:</span>
                  <span className="text-xs text-gray-900">
                    {formatCurrency(product.cost || (product.is_direct_sale && product.inventory_items?.cost_per_unit) || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Gewinn:</span>
                  <span className={`text-xs font-semibold ${
                    ((product.price_netto || product.price) - (product.cost || (product.is_direct_sale && product.inventory_items?.cost_per_unit) || 0)) > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency((product.price_netto || product.price) - (product.cost || (product.is_direct_sale && product.inventory_items?.cost_per_unit) || 0))}
                  </span>
                </div>
                {product.is_direct_sale && product.inventory_items && (
                  <div className="flex items-center space-x-1 text-xs text-gray-600">
                    <LinkIcon className="h-2.5 w-2.5" />
                    <span className="truncate">{product.inventory_items.name}</span>
                  </div>
                )}
                {!product.is_direct_sale && product.product_recipes && product.product_recipes.length > 0 && (
                  <div className="flex items-center space-x-1 text-xs text-gray-600">
                    <ChefHat className="h-2.5 w-2.5" />
                    <span>{product.product_recipes.length} Zutaten</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-1 pt-2 border-t border-gray-200">
                {!product.is_direct_sale && (
                  <button
                    onClick={() => openRecipeDialog(product)}
                    className="flex-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
                  >
                    Rezept
                  </button>
                )}
                <button
                  onClick={() => openEditDialog(product)}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title="Bearbeiten"
                >
                  <Edit className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    setDeletingProduct(product)
                    setShowDeleteDialog(true)
                  }}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
            </div>
          </div>
        ))}

        {products.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Noch keine Produkte vorhanden</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Erstes Produkt erstellen
            </button>
          </div>
        )}
      </div>

      {/* Create Form Dialog */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Neues Produkt</h2>
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
            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preis-Eingabe
                </label>
                <div className="flex items-center space-x-4 mb-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="priceMode"
                      checked={priceInputMode === 'brutto'}
                      onChange={() => setPriceInputMode('brutto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Brutto (inkl. MwSt)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="priceMode"
                      checked={priceInputMode === 'netto'}
                      onChange={() => setPriceInputMode('netto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Netto (exkl. MwSt)</span>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {priceInputMode === 'brutto' ? (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preis Brutto (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={createFormData.price_brutto}
                        onChange={(e) => {
                          const brutto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(createFormData.vat_rate) || 19.0
                          const netto = brutto / (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            price_brutto: e.target.value,
                            price_netto: netto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preis Netto (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={createFormData.price_netto}
                        onChange={(e) => {
                          const netto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(createFormData.vat_rate) || 19.0
                          const brutto = netto * (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            price_netto: e.target.value,
                            price_brutto: brutto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
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
                        let netto = parseFloat(createFormData.price_netto) || 0
                        let brutto = parseFloat(createFormData.price_brutto) || 0
                        
                        if (priceInputMode === 'brutto' && brutto > 0) {
                          netto = brutto / (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            vat_rate: e.target.value,
                            price_netto: netto.toFixed(2)
                          })
                        } else if (priceInputMode === 'netto' && netto > 0) {
                          brutto = netto * (1 + vatRate / 100)
                          setCreateFormData({
                            ...createFormData,
                            vat_rate: e.target.value,
                            price_brutto: brutto.toFixed(2)
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
                {createFormData.price_brutto && createFormData.price_netto && (
                  <div className="mt-2 text-xs text-gray-500">
                    {priceInputMode === 'brutto' ? (
                      <>Netto: {formatCurrency(parseFloat(createFormData.price_netto))}</>
                    ) : (
                      <>Brutto: {formatCurrency(parseFloat(createFormData.price_brutto))}</>
                    )}
                  </div>
                )}
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
                    SKU
                  </label>
                  <input
                    type="text"
                    value={createFormData.sku}
                    onChange={(e) => setCreateFormData({ ...createFormData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={createFormData.barcode}
                    onChange={(e) => setCreateFormData({ ...createFormData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_direct_sale"
                  checked={createFormData.is_direct_sale}
                  onChange={(e) => setCreateFormData({ ...createFormData, is_direct_sale: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_direct_sale" className="text-sm font-medium text-gray-700">
                  Direkter Verkauf (direkt mit Inventar-Item verknüpft)
                </label>
              </div>
              {createFormData.is_direct_sale && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inventar-Item
                  </label>
                  <select
                    value={createFormData.inventory_item_id}
                    onChange={(e) => setCreateFormData({ ...createFormData, inventory_item_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.current_stock} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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

      {/* Edit Dialog - Similar structure, truncated for brevity */}
      {showEditDialog && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Produkt bearbeiten</h2>
                <button
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingProduct(null)
                    setError(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <form onSubmit={handleEditProduct} className="p-6 space-y-4">
              {/* Similar form fields as create, with editFormData */}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preis-Eingabe
                </label>
                <div className="flex items-center space-x-4 mb-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="editPriceMode"
                      checked={priceInputMode === 'brutto'}
                      onChange={() => setPriceInputMode('brutto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Brutto (inkl. MwSt)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="editPriceMode"
                      checked={priceInputMode === 'netto'}
                      onChange={() => setPriceInputMode('netto')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Netto (exkl. MwSt)</span>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {priceInputMode === 'brutto' ? (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preis Brutto (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.price_brutto}
                        onChange={(e) => {
                          const brutto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(editFormData.vat_rate) || 19.0
                          const netto = brutto / (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            price_brutto: e.target.value,
                            price_netto: netto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preis Netto (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.price_netto}
                        onChange={(e) => {
                          const netto = parseFloat(e.target.value) || 0
                          const vatRate = parseFloat(editFormData.vat_rate) || 19.0
                          const brutto = netto * (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            price_netto: e.target.value,
                            price_brutto: brutto.toFixed(2)
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
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
                        let netto = parseFloat(editFormData.price_netto) || 0
                        let brutto = parseFloat(editFormData.price_brutto) || 0
                        
                        if (priceInputMode === 'brutto' && brutto > 0) {
                          netto = brutto / (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            vat_rate: e.target.value,
                            price_netto: netto.toFixed(2)
                          })
                        } else if (priceInputMode === 'netto' && netto > 0) {
                          brutto = netto * (1 + vatRate / 100)
                          setEditFormData({
                            ...editFormData,
                            vat_rate: e.target.value,
                            price_brutto: brutto.toFixed(2)
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
                {editFormData.price_brutto && editFormData.price_netto && (
                  <div className="mt-2 text-xs text-gray-500">
                    {priceInputMode === 'brutto' ? (
                      <>Netto: {formatCurrency(parseFloat(editFormData.price_netto))}</>
                    ) : (
                      <>Brutto: {formatCurrency(parseFloat(editFormData.price_brutto))}</>
                    )}
                  </div>
                )}
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
                    SKU
                  </label>
                  <input
                    type="text"
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={editFormData.barcode}
                    onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit_is_direct_sale"
                  checked={editFormData.is_direct_sale}
                  onChange={(e) => setEditFormData({ ...editFormData, is_direct_sale: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="edit_is_direct_sale" className="text-sm font-medium text-gray-700">
                  Direkter Verkauf
                </label>
              </div>
              {editFormData.is_direct_sale && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inventar-Item
                  </label>
                  <select
                    value={editFormData.inventory_item_id}
                    onChange={(e) => setEditFormData({ ...editFormData, inventory_item_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.current_stock} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="edit_is_active" className="text-sm font-medium text-gray-700">
                  Aktiv
                </label>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingProduct(null)
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

      {/* Recipe Dialog */}
      {showRecipeDialog && recipeProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Rezept bearbeiten</h2>
                  <p className="text-sm text-gray-600 mt-1">{recipeProduct.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowRecipeDialog(false)
                    setRecipeProduct(null)
                    setError(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* Existing Recipe Items */}
              {recipeProduct.product_recipes && recipeProduct.product_recipes.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Aktuelle Zutaten</h3>
                  <div className="space-y-2">
                    {recipeProduct.product_recipes.map((recipe) => (
                      <div key={recipe.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">{recipe.inventory_items.name}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            {recipe.quantity} {recipe.unit}
                          </span>
                          {recipe.notes && (
                            <p className="text-xs text-gray-500 mt-1">{recipe.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteRecipeItem(recipe.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Recipe Item */}
              <form onSubmit={handleAddRecipeItem} className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Zutat hinzufügen</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inventar-Item *
                  </label>
                  <select
                    value={recipeFormData.inventory_item_id}
                    onChange={(e) => {
                      const selectedItem = inventoryItems.find(item => item.id === e.target.value)
                      setRecipeFormData({
                        ...recipeFormData,
                        inventory_item_id: e.target.value,
                        unit: selectedItem?.unit || ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Bitte wählen...</option>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.current_stock} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Menge *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={recipeFormData.quantity}
                      onChange={(e) => setRecipeFormData({ ...recipeFormData, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Einheit *
                    </label>
                    <input
                      type="text"
                      value={recipeFormData.unit}
                      onChange={(e) => setRecipeFormData({ ...recipeFormData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notizen
                  </label>
                  <input
                    type="text"
                    value={recipeFormData.notes}
                    onChange={(e) => setRecipeFormData({ ...recipeFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecipeDialog(false)
                      setRecipeProduct(null)
                      setError(null)
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Schließen
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isCreating ? 'Hinzufügen...' : 'Hinzufügen'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && deletingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Produkt löschen?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Möchten Sie "{deletingProduct.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeletingProduct(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteProduct}
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

