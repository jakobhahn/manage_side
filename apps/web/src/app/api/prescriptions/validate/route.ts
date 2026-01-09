import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PrescriptionData, PrescriptionContext } from '@hans/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']

/**
 * POST /api/prescriptions/validate
 * Upload and validate a prescription image
 */
export async function POST(request: NextRequest) {
  // Log collection setup - declare outside try/catch
  const logs: string[] = []
  let originalLog: typeof console.log | undefined = undefined
  let originalError: typeof console.error | undefined = undefined
  let originalWarn: typeof console.warn | undefined = undefined
  
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Authorization token required' } },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json(
        { error: { message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Get user data
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', user.id)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const patientId = formData.get('patientId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: { message: 'No file provided' } },
        { status: 400 }
      )
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` } },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { message: 'Invalid file type. Only JPEG, PNG, and PDF are allowed.' } },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Convert PDF first page to image if needed
    let imageBuffer = buffer
    if (file.type === 'application/pdf') {
      // TODO: Implement PDF to image conversion
      // For now, return error
      return NextResponse.json(
        { error: { message: 'PDF support not yet implemented. Please upload an image file.' } },
        { status: 400 }
      )
    }

    // Override console methods to capture logs - START EARLY
    originalLog = console.log
    originalError = console.error
    originalWarn = console.warn
    
    // Override console methods to capture logs
    console.log = (...args: any[]) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
      logs.push(`[LOG] ${message}`)
      originalLog(...args)
    }
    console.error = (...args: any[]) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
      logs.push(`[ERROR] ${message}`)
      originalError(...args)
    }
    console.warn = (...args: any[]) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
      logs.push(`[WARN] ${message}`)
      originalWarn(...args)
    }

    try {
      // Load modules dynamically to avoid build issues
      const barcodeModule = await import('../../../../lib/prescription/barcode-decoder')
      const ocrModule = await import('../../../../lib/prescription/ocr-extractor')
      const validatorModule = await import('../../../../lib/prescription/validator')

      // Try to extract data: first try barcode, then OCR
      let prescriptionData: Partial<PrescriptionData> = {
        rawSource: 'OCR' as const
      }

      // Try barcode first
      console.log('Attempting to decode barcode from image...')
      console.log('Image buffer size:', imageBuffer.length, 'bytes')
      const barcodeResult = await barcodeModule.tryDecodeBarcode(imageBuffer)
      console.log('Barcode decode result:', barcodeResult ? `Found ${barcodeResult.format}: ${barcodeResult.data.substring(0, 50)}...` : 'Not found')
      
      if (barcodeResult && barcodeResult.data) {
        console.log('Barcode format:', barcodeResult.format, 'Data length:', barcodeResult.data.length)
        console.log('Barcode raw data:', barcodeResult.data)
        const barcodeData = barcodeModule.parseBarcodeData(barcodeResult.data)
        prescriptionData = {
          ...barcodeData,
          rawSource: 'BARCODE' as const
        }
        console.log('Parsed barcode data keys:', Object.keys(prescriptionData))
        console.log('Parsed barcode data:', JSON.stringify(prescriptionData, null, 2))
      } else {
        console.log('No barcode found, falling back to OCR')
        // Fallback to OCR
        const ocrData = await ocrModule.runOcrExtraction(imageBuffer)
        prescriptionData = {
          ...ocrData,
          rawSource: 'OCR' as const
        }
      }

    // Build context for validation
    const context: PrescriptionContext = {
      organizationId: userData.organization_id,
      userId: userData.id,
      patientId: patientId || undefined
    }

    // Fetch existing prescriptions for overlap check
    if (patientId) {
      const { data: existingPrescriptions } = await supabase
        .from('prescriptions')
        .select('id, issue_date, raw_data')
        .eq('organization_id', userData.organization_id)
        .eq('patient_id', patientId)
        .order('issue_date', { ascending: false })
        .limit(10)

      if (existingPrescriptions) {
        context.existingPrescriptions = existingPrescriptions.map(p => ({
          id: p.id,
          issueDate: p.issue_date,
          therapy: p.raw_data?.therapy,
          diagnosis: p.raw_data?.diagnosis
        }))
      }
    }

    // Validate prescription
    const validationResult = validatorModule.validatePrescription(
      prescriptionData as PrescriptionData,
      context
    )

    // Optionally save to database
    // For now, we'll save it for history
    const { data: savedPrescription, error: saveError } = await supabase
      .from('prescriptions')
      .insert({
        organization_id: userData.organization_id,
        user_id: userData.id,
        patient_id: patientId || null,
        source_type: validationResult.source,
        raw_data: prescriptionData,
        insurer_name: prescriptionData.insurer?.name,
        insurer_ik: prescriptionData.insurer?.ik,
        patient_first_name: prescriptionData.patient?.firstName,
        patient_last_name: prescriptionData.patient?.lastName,
        patient_dob: prescriptionData.patient?.dob ? new Date(prescriptionData.patient.dob) : null,
        patient_insurance_no: prescriptionData.patient?.insuranceNo,
        prescriber_name: prescriptionData.prescriber?.name,
        prescriber_lanr: prescriptionData.prescriber?.lanr,
        prescriber_bsnr: prescriptionData.prescriber?.bsnr,
        prescriber_signature_present: prescriptionData.prescriber?.signaturePresent || false,
        prescriber_stamp_present: prescriptionData.prescriber?.stampPresent || false,
        issue_date: prescriptionData.prescriber?.issueDate
          ? parseGermanDate(prescriptionData.prescriber.issueDate)
          : null,
        icd10_code: prescriptionData.diagnosis?.icd10,
        diagnosis_group: prescriptionData.diagnosis?.diagnosisGroup,
        diagnosis_free_text: prescriptionData.diagnosis?.freeText,
        therapy_area: prescriptionData.therapy?.area,
        primary_remedy: prescriptionData.therapy?.primaryRemedy,
        secondary_remedy: prescriptionData.therapy?.secondaryRemedy,
        units: prescriptionData.therapy?.units,
        frequency: prescriptionData.therapy?.frequency,
        urgent: prescriptionData.therapy?.urgent || false,
        home_visit: prescriptionData.therapy?.homeVisit || false,
        validation_status: validationResult.status,
        validation_checks: validationResult.checks,
        billing_ready: validationResult.billingReady,
        confidence_scores: prescriptionData.confidence || {}
      })
      .select()
      .single()

      if (saveError) {
        console.error('Failed to save prescription:', saveError)
        // Continue anyway, return validation result
      }

      return NextResponse.json({
        ...validationResult,
        prescriptionId: savedPrescription?.id,
        debugLogs: logs
      })
    } finally {
      // Restore console methods
      if (typeof originalLog !== 'undefined') {
        console.log = originalLog
      }
      if (typeof originalError !== 'undefined') {
        console.error = originalError
      }
      if (typeof originalWarn !== 'undefined') {
        console.warn = originalWarn
      }
    }
  } catch (error) {
    // Try to restore console if it was overridden
    try {
      if (typeof originalLog !== 'undefined') {
        console.log = originalLog
        console.error = originalError
        console.warn = originalWarn
      }
    } catch {}
    
    console.error('Prescription validation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Include logs in error response if available
    const errorLogs = typeof logs !== 'undefined' ? logs : []
    
    return NextResponse.json(
      { 
        error: { 
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? errorStack : undefined
        },
        debugLogs: errorLogs
      },
      { status: 500 }
    )
  }
}

/**
 * Helper: Parse German date format (DD.MM.YYYY) to Date
 */
function parseGermanDate(dateStr: string): Date | null {
  try {
    const parts = dateStr.split('.')
    if (parts.length !== 3) return null
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    return new Date(year, month, day)
  } catch {
    return null
  }
}

