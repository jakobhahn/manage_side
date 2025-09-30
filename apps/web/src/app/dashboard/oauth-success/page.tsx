'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function OAuthSuccessPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const merchantCode = searchParams.get('merchant_code')
  const organizationId = searchParams.get('organization_id')
  const oauthError = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const handleOAuthSuccess = async () => {
      try {
        // Check if there's an error from the OAuth callback
        if (oauthError) {
          console.error('OAuth error received:', oauthError, errorDescription)
          setError(`OAuth Fehler: ${errorDescription || oauthError}`)
          return
        }

        // Check if user is still logged in
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          console.error('No session found after OAuth callback')
          setError('Session verloren. Bitte melde dich erneut an.')
          return
        }

        console.log('Session found after OAuth callback:', session.user?.id)
        
        // Wait a moment to ensure everything is processed
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Redirect to dashboard with success message
        router.push(`/dashboard?sumup_success=oauth_connected&merchant_code=${merchantCode}`)
        
      } catch (err) {
        console.error('Error handling OAuth success:', err)
        setError('Fehler beim Verarbeiten der OAuth-Autorisierung.')
      } finally {
        setIsLoading(false)
      }
    }

    handleOAuthSuccess()
  }, [merchantCode, organizationId, oauthError, errorDescription, router, supabase.auth])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">OAuth-Autorisierung wird verarbeitet...</h2>
          <p className="text-gray-600">Bitte warten Sie einen Moment.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-red-600">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Fehler</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Zum Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">OAuth-Autorisierung erfolgreich!</h2>
        <p className="text-gray-600">Sie werden zum Dashboard weitergeleitet...</p>
      </div>
    </div>
  )
}
