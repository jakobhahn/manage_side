'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, User, Mail, Globe } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface RegisterFormData {
  organizationName: string
  organizationSlug: string
  ownerName: string
  ownerEmail: string
  password: string
  confirmPassword: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [formData, setFormData] = useState<RegisterFormData>({
    organizationName: '',
    organizationSlug: '',
    ownerName: '',
    ownerEmail: '',
    password: '',
    confirmPassword: ''
  })

  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Auto-generate slug from organization name
    if (field === 'organizationName') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      setFormData(prev => ({ ...prev, organizationSlug: slug }))
    }
  }

  const validateForm = (): string | null => {
    if (!formData.organizationName.trim()) {
      return 'Organization name is required'
    }
    if (!formData.organizationSlug.trim()) {
      return 'Organization slug is required'
    }
    if (!/^[a-z0-9-]+$/.test(formData.organizationSlug)) {
      return 'Organization slug can only contain lowercase letters, numbers, and hyphens'
    }
    if (!formData.ownerName.trim()) {
      return 'Owner name is required'
    }
    if (!formData.ownerEmail.trim()) {
      return 'Owner email is required'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      return 'Please enter a valid email address'
    }
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // First, sign up the user with Supabase Auth
      const authResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.ownerEmail,
          password: formData.password,
          name: formData.ownerName,
        }),
      })

      const authData = await authResponse.json()

      if (!authResponse.ok) {
        const errorMessage = authData.error?.message || authData.error || 'Failed to create user account'
        throw new Error(errorMessage)
      }

      // Then create the organization
      const orgResponse = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session?.access_token}`,
        },
        body: JSON.stringify({
          name: formData.organizationName,
          slug: formData.organizationSlug,
          ownerName: formData.ownerName,
          ownerEmail: formData.ownerEmail,
        }),
      })

      const orgData = await orgResponse.json()

      if (!orgResponse.ok) {
        const errorMessage = orgData.error?.message || orgData.error || 'Failed to create organization'
        throw new Error(errorMessage)
      }

      // Set the session in Supabase client
      if (authData.session) {
        await supabase.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        })
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl flat-shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-6">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Create Your Restaurant</h1>
            <p className="text-gray-600 text-sm">
              Set up your organization and become the admin
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="organizationName" className="text-sm font-medium text-gray-700">Restaurant Name</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="organizationName"
                  type="text"
                  placeholder="My Restaurant"
                  value={formData.organizationName}
                  onChange={(e) => handleInputChange('organizationName', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="organizationSlug" className="text-sm font-medium text-gray-700">Organization URL</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="organizationSlug"
                  type="text"
                  placeholder="my-restaurant"
                  value={formData.organizationSlug}
                  onChange={(e) => handleInputChange('organizationSlug', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 break-words">
                hans-app.com/{formData.organizationSlug || 'your-slug'}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="ownerName" className="text-sm font-medium text-gray-700">Your Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="ownerName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.ownerName}
                  onChange={(e) => handleInputChange('ownerName', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="ownerEmail" className="text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="ownerEmail"
                  type="email"
                  placeholder="john@myrestaurant.com"
                  value={formData.ownerEmail}
                  onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl font-medium text-sm hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Organization...
                </div>
              ) : (
                'Create Organization'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-gray-900 font-medium hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
