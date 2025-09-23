'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, User, Mail, Globe } from 'lucide-react'

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
      const { data: authData, error: authError } = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.ownerEmail,
          password: formData.password,
          name: formData.ownerName,
        }),
      }).then(res => res.json())

      if (authError) {
        throw new Error(authError.message)
      }

      // Then create the organization
      const { data: orgData, error: orgError } = await fetch('/api/organizations', {
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
      }).then(res => res.json())

      if (orgError) {
        throw new Error(orgError.message)
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Restaurant</CardTitle>
          <CardDescription>
            Set up your organization and become the admin
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="organizationName">Restaurant Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="My Restaurant"
                  value={formData.organizationName}
                  onChange={(e) => handleInputChange('organizationName', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationSlug">Organization URL</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="organizationSlug"
                  type="text"
                  placeholder="my-restaurant"
                  value={formData.organizationSlug}
                  onChange={(e) => handleInputChange('organizationSlug', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                This will be your unique URL: hans-app.com/{formData.organizationSlug || 'your-slug'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerName">Your Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="ownerName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.ownerName}
                  onChange={(e) => handleInputChange('ownerName', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 h-4 w-4 text-gray-400" />
                <Input
                  id="ownerEmail"
                  type="email"
                  placeholder="john@myrestaurant.com"
                  value={formData.ownerEmail}
                  onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Organization...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
