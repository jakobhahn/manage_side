'use client'

import { useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { ValidationResult, ValidationCheck, ValidationPhase } from '@hans/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function PrescriptionsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Nur Bilddateien (JPG, PNG) oder PDF werden unterstützt')
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Datei ist zu groß. Maximale Größe: 10MB')
      return
    }

    setSelectedFile(file)
    setError(null)
    setValidationResult(null)

    // Create preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/prescriptions/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        throw new Error(`Server returned non-JSON response (${response.status}). Check server logs.`)
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        throw new Error(errorData.error?.message || `Fehler beim Hochladen (${response.status})`)
      }

      const result: any = await response.json()
      setValidationResult(result)
      if (result.debugLogs) {
        setDebugLogs(result.debugLogs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Hochladen')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setValidationResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'WARN':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'FEHLER':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'WARN':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'FEHLER':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return null
    }
  }

  const getCheckIcon = (level: string) => {
    switch (level) {
      case 'OK':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'WARN':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'FEHLER':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const groupChecksByPhase = (checks: ValidationCheck[]) => {
    const grouped: Record<ValidationPhase, ValidationCheck[]> = {
      PRE: [],
      DURING: [],
      POST: []
    }
    checks.forEach(check => {
      grouped[check.phase].push(check)
    })
    return grouped
  }

  const phaseLabels: Record<ValidationPhase, string> = {
    PRE: 'Vor der Behandlung',
    DURING: 'Während der Behandlung',
    POST: 'Nach der Behandlung / Abrechnung'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rezept prüfen</h1>
              <p className="text-sm text-gray-600">Heilmittelverordnung (GKV Muster 13) hochladen und prüfen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rezept hochladen</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bild oder PDF auswählen
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-gray-800"
              />
              <p className="mt-1 text-xs text-gray-500">
                Unterstützte Formate: JPG, PNG, PDF (max. 10MB)
              </p>
            </div>

            {previewUrl && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Vorschau:</p>
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-md border border-gray-200 rounded-lg"
                />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Wird geprüft...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Rezept prüfen</span>
                  </>
                )}
              </button>
              {selectedFile && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Debug Logs Toggle */}
        {debugLogs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full"
            >
              <span>{showLogs ? '▼' : '▶'}</span>
              <span>Server-Logs anzeigen ({debugLogs.length} Einträge)</span>
            </button>
            {showLogs && (
              <div className="mt-4 bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg overflow-auto max-h-96">
                {debugLogs.map((log, index) => (
                  <div key={index} className="mb-1 whitespace-pre-wrap break-words">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-6">
            {/* Status Summary */}
            <div className={`bg-white rounded-xl shadow-sm border-2 p-6 ${getStatusColor(validationResult.status)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(validationResult.status)}
                  <div>
                    <h2 className="text-lg font-semibold">Prüfstatus: {validationResult.status}</h2>
                    <p className="text-sm opacity-75">
                      Quelle: {validationResult.source === 'BARCODE' ? 'Barcode' : 'OCR'}
                    </p>
                  </div>
                </div>
                {validationResult.billingReady && (
                  <span className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
                    Abrechnungsreif
                  </span>
                )}
              </div>
            </div>

            {/* Extracted Data */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Extrahierte Daten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {validationResult.data.prescriber?.issueDate && (
                  <div>
                    <p className="text-sm text-gray-600">Ausstellungsdatum</p>
                    <p className="font-medium">{validationResult.data.prescriber.issueDate}</p>
                  </div>
                )}
                {validationResult.data.diagnosis?.icd10 && (
                  <div>
                    <p className="text-sm text-gray-600">ICD-10</p>
                    <p className="font-medium">{validationResult.data.diagnosis.icd10}</p>
                  </div>
                )}
                {validationResult.data.diagnosis?.diagnosisGroup && (
                  <div>
                    <p className="text-sm text-gray-600">Diagnosegruppe</p>
                    <p className="font-medium">{validationResult.data.diagnosis.diagnosisGroup}</p>
                  </div>
                )}
                {validationResult.data.therapy?.primaryRemedy && (
                  <div>
                    <p className="text-sm text-gray-600">Vorrangiges Heilmittel</p>
                    <p className="font-medium">{validationResult.data.therapy.primaryRemedy}</p>
                  </div>
                )}
                {validationResult.data.therapy?.units && (
                  <div>
                    <p className="text-sm text-gray-600">Behandlungseinheiten</p>
                    <p className="font-medium">{validationResult.data.therapy.units}</p>
                  </div>
                )}
                {validationResult.data.therapy?.frequency && (
                  <div>
                    <p className="text-sm text-gray-600">Frequenz</p>
                    <p className="font-medium">{validationResult.data.therapy.frequency}</p>
                  </div>
                )}
                {validationResult.data.patient?.firstName && (
                  <div>
                    <p className="text-sm text-gray-600">Patient</p>
                    <p className="font-medium">
                      {validationResult.data.patient.firstName} {validationResult.data.patient.lastName}
                    </p>
                  </div>
                )}
                {validationResult.data.prescriber?.name && (
                  <div>
                    <p className="text-sm text-gray-600">Arzt</p>
                    <p className="font-medium">{validationResult.data.prescriber.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Validation Checks */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Prüfergebnisse</h3>
              
              {validationResult.checks.length === 0 ? (
                <p className="text-sm text-gray-600">Keine Prüfungen durchgeführt</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupChecksByPhase(validationResult.checks)).map(([phase, checks]) => {
                    if (checks.length === 0) return null
                    return (
                      <div key={phase}>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          {phaseLabels[phase as ValidationPhase]}
                        </h4>
                        <div className="space-y-2">
                          {checks.map((check, index) => (
                            <div
                              key={index}
                              className={`flex items-start space-x-3 p-3 rounded-lg border ${
                                check.level === 'FEHLER'
                                  ? 'bg-red-50 border-red-200'
                                  : check.level === 'WARN'
                                  ? 'bg-yellow-50 border-yellow-200'
                                  : 'bg-green-50 border-green-200'
                              }`}
                            >
                              {getCheckIcon(check.level)}
                              <div className="flex-1">
                                <p className="text-sm font-medium">{check.message}</p>
                                {check.field && (
                                  <p className="text-xs text-gray-500 mt-1">Feld: {check.field}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

