/**
 * Prescription validation engine with 3-phase checks (iPrax-style)
 * PRE: Before treatment
 * DURING: During treatment
 * POST: After treatment / billing
 */

import {
  PrescriptionData,
  ValidationCheck,
  ValidationLevel,
  ValidationPhase,
  ValidationResult,
  PrescriptionContext
} from '@hans/types'

/**
 * Validate prescription data with 3-phase checks
 */
export function validatePrescription(
  data: PrescriptionData,
  context?: PrescriptionContext
): ValidationResult {
  const checks: ValidationCheck[] = []
  
  // Phase 1: PRE - Before treatment checks
  const preChecks = runPreChecks(data)
  checks.push(...preChecks)
  
  // Phase 2: DURING - During treatment checks (if context available)
  if (context) {
    const duringChecks = runDuringChecks(data, context)
    checks.push(...duringChecks)
  }
  
  // Phase 3: POST - After treatment / billing checks (if context available)
  if (context) {
    const postChecks = runPostChecks(data, context)
    checks.push(...postChecks)
  }
  
  // Check for overlaps with existing prescriptions
  if (context?.existingPrescriptions) {
    const overlapChecks = checkOverlaps(data, context)
    checks.push(...overlapChecks)
  }
  
  // Determine overall status
  const status = determineOverallStatus(checks)
  
  // Determine if billing ready
  const billingReady = determineBillingReady(checks, data)
  
  return {
    status,
    source: data.rawSource,
    data,
    checks,
    billingReady
  }
}

/**
 * Phase 1: PRE - Before treatment checks
 */
function runPreChecks(data: PrescriptionData): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  
  // Required fields checks
  if (!data.prescriber?.issueDate) {
    checks.push({
      code: 'MISSING_ISSUE_DATE',
      phase: 'PRE',
      level: 'FEHLER',
      message: 'Ausstellungsdatum fehlt',
      field: 'prescriber.issueDate'
    })
  }
  
  if (!data.prescriber?.signaturePresent && !data.prescriber?.stampPresent) {
    checks.push({
      code: 'MISSING_SIGNATURE_STAMP',
      phase: 'PRE',
      level: 'WARN',
      message: 'Arztstempel oder Unterschrift nicht eindeutig erkennbar',
      field: 'prescriber.signaturePresent'
    })
  }
  
  if (!data.diagnosis?.icd10) {
    checks.push({
      code: 'MISSING_ICD10',
      phase: 'PRE',
      level: 'FEHLER',
      message: 'ICD-10 Code fehlt',
      field: 'diagnosis.icd10'
    })
  }
  
  if (!data.diagnosis?.diagnosisGroup) {
    checks.push({
      code: 'MISSING_DIAGNOSIS_GROUP',
      phase: 'PRE',
      level: 'FEHLER',
      message: 'Diagnosegruppe fehlt',
      field: 'diagnosis.diagnosisGroup'
    })
  }
  
  if (!data.therapy?.primaryRemedy) {
    checks.push({
      code: 'MISSING_PRIMARY_REMEDY',
      phase: 'PRE',
      level: 'FEHLER',
      message: 'Vorrangiges Heilmittel fehlt',
      field: 'therapy.primaryRemedy'
    })
  }
  
  if (!data.therapy?.units || data.therapy.units <= 0) {
    checks.push({
      code: 'MISSING_OR_INVALID_UNITS',
      phase: 'PRE',
      level: 'FEHLER',
      message: 'Anzahl Behandlungseinheiten fehlt oder ist ungültig',
      field: 'therapy.units'
    })
  }
  
  if (!data.therapy?.frequency) {
    checks.push({
      code: 'MISSING_FREQUENCY',
      phase: 'PRE',
      level: 'FEHLER',
      message: 'Therapiefrequenz fehlt',
      field: 'therapy.frequency'
    })
  }
  
  if (data.therapy?.area !== 'PHYSIO') {
    checks.push({
      code: 'INVALID_THERAPY_AREA',
      phase: 'PRE',
      level: 'WARN',
      message: 'Heilmittelbereich nicht als Physiotherapie erkennbar',
      field: 'therapy.area'
    })
  }
  
  // Consistency checks
  if (data.therapy?.frequency) {
    const freqValid = /^(\d+)[-x]?(\d+)?\s*x?\s*(wöch|Woche|Wochen)/i.test(data.therapy.frequency)
    if (!freqValid) {
      checks.push({
        code: 'INVALID_FREQUENCY_FORMAT',
        phase: 'PRE',
        level: 'WARN',
        message: 'Frequenzformat möglicherweise ungültig',
        field: 'therapy.frequency'
      })
    }
  }
  
  // Check for multiple secondary remedies
  if (data.therapy?.secondaryRemedy && data.therapy.secondaryRemedy.split(',').length > 1) {
    checks.push({
      code: 'MULTIPLE_SECONDARY_REMEDIES',
      phase: 'PRE',
      level: 'WARN',
      message: 'Mehr als ein ergänzendes Heilmittel angegeben',
      field: 'therapy.secondaryRemedy'
    })
  }
  
  // Check units count
  if (data.therapy?.units && data.therapy.units > 24) {
    checks.push({
      code: 'UNUSUAL_UNITS_COUNT',
      phase: 'PRE',
      level: 'WARN',
      message: `Ungewöhnlich hohe Anzahl von Behandlungseinheiten: ${data.therapy.units}`,
      field: 'therapy.units'
    })
  }
  
  // Check deadline (28 days)
  if (data.prescriber?.issueDate) {
    const issueDate = parseGermanDate(data.prescriber.issueDate)
    if (issueDate) {
      const daysSinceIssue = Math.floor(
        (Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceIssue > 28) {
        checks.push({
          code: 'DEADLINE_EXCEEDED',
          phase: 'PRE',
          level: 'WARN',
          message: `Behandlungsbeginn evtl. Frist überschritten (${daysSinceIssue} Tage seit Ausstellung)`,
          field: 'prescriber.issueDate'
        })
      }
    }
  }
  
  return checks
}

/**
 * Phase 2: DURING - During treatment checks
 */
function runDuringChecks(
  data: PrescriptionData,
  context: PrescriptionContext
): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  
  // Check if appointments match frequency
  if (context.appointments && data.therapy?.frequency) {
    const freqMatch = data.therapy.frequency.match(/(\d+)/)
    const expectedPerWeek = freqMatch ? parseInt(freqMatch[1], 10) : 1
    
    // Group appointments by week
    const appointmentsByWeek = groupByWeek(context.appointments)
    
    // Check for gaps
    for (const [week, appointments] of Object.entries(appointmentsByWeek)) {
      if (appointments.length < expectedPerWeek - 1) {
        checks.push({
          code: 'FREQUENCY_DEVIATION',
          phase: 'DURING',
          level: 'WARN',
          message: `Frequenzabweichung in Woche ${week}: ${appointments.length} Termine statt ${expectedPerWeek}`,
          field: 'therapy.frequency'
        })
      }
    }
    
    // Check for long gaps
    const sortedDates = context.appointments
      .map(a => new Date(a.date))
      .sort((a, b) => a.getTime() - b.getTime())
    
    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = Math.floor(
        (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff > 14 && expectedPerWeek >= 1) {
        checks.push({
          code: 'LONG_GAP_BETWEEN_APPOINTMENTS',
          phase: 'DURING',
          level: 'WARN',
          message: `Lange Pause zwischen Terminen: ${daysDiff} Tage`,
          field: 'appointments'
        })
      }
    }
  }
  
  // Check if units exceeded
  if (context.appointments && data.therapy?.units) {
    const appointmentCount = context.appointments.length
    if (appointmentCount > data.therapy.units) {
      checks.push({
        code: 'UNITS_EXCEEDED',
        phase: 'DURING',
        level: 'FEHLER',
        message: `Termine (${appointmentCount}) überschreiten Verordnungsmenge (${data.therapy.units})`,
        field: 'therapy.units'
      })
    }
  }
  
  return checks
}

/**
 * Phase 3: POST - After treatment / billing checks
 */
function runPostChecks(
  data: PrescriptionData,
  context: PrescriptionContext
): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  
  // Check if prescription is complete and ready for billing
  if (data.therapy?.units && context.appointments) {
    const appointmentCount = context.appointments.length
    if (appointmentCount >= data.therapy.units) {
      // All units used, ready for billing
      // This is handled by determineBillingReady
    }
  }
  
  // Verify all required fields are present for billing
  const requiredForBilling = [
    data.prescriber?.issueDate,
    data.diagnosis?.icd10,
    data.diagnosis?.diagnosisGroup,
    data.therapy?.primaryRemedy,
    data.therapy?.units,
    data.patient?.insuranceNo || data.patient?.firstName
  ]
  
  const missingForBilling = requiredForBilling.filter(f => !f).length
  if (missingForBilling > 0) {
    checks.push({
      code: 'INCOMPLETE_FOR_BILLING',
      phase: 'POST',
      level: 'FEHLER',
      message: `${missingForBilling} Pflichtfeld(er) für Abrechnung fehlen`,
      field: 'billing'
    })
  }
  
  return checks
}

/**
 * Check for overlaps with existing prescriptions
 */
function checkOverlaps(
  data: PrescriptionData,
  context: PrescriptionContext
): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  
  if (!context.existingPrescriptions || !data.prescriber?.issueDate) {
    return checks
  }
  
  const issueDate = parseGermanDate(data.prescriber.issueDate)
  if (!issueDate) {
    return checks
  }
  
  // Check for overlapping prescriptions with same therapy area/diagnosis
  const overlapping = context.existingPrescriptions.filter(existing => {
    if (!existing.issueDate) return false
    
    const existingDate = parseGermanDate(existing.issueDate)
    if (!existingDate) return false
    
    // Check if dates overlap (within 3 months)
    const daysDiff = Math.abs(
      (issueDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysDiff > 90) return false
    
    // Check if same therapy area
    if (existing.therapy?.area && data.therapy?.area) {
      if (existing.therapy.area !== data.therapy.area) return false
    }
    
    // Check if same diagnosis group
    if (existing.diagnosis?.diagnosisGroup && data.diagnosis?.diagnosisGroup) {
      if (existing.diagnosis.diagnosisGroup !== data.diagnosis.diagnosisGroup) {
        return false
      }
    }
    
    return true
  })
  
  if (overlapping.length > 0) {
    checks.push({
      code: 'OVERLAP_EXISTING_VO',
      phase: 'PRE',
      level: 'WARN',
      message: `Zeitliche Überschneidung mit ${overlapping.length} anderer Verordnung(en)`,
      field: 'prescriber.issueDate'
    })
  }
  
  return checks
}

/**
 * Determine overall validation status
 */
function determineOverallStatus(checks: ValidationCheck[]): ValidationLevel {
  const hasError = checks.some(c => c.level === 'FEHLER')
  const hasWarn = checks.some(c => c.level === 'WARN')
  
  if (hasError) return 'FEHLER'
  if (hasWarn) return 'WARN'
  return 'OK'
}

/**
 * Determine if prescription is ready for billing
 */
function determineBillingReady(
  checks: ValidationCheck[],
  data: PrescriptionData
): boolean {
  // Must have no errors
  const hasError = checks.some(c => c.level === 'FEHLER')
  if (hasError) return false
  
  // Must have all required fields
  const requiredFields = [
    data.prescriber?.issueDate,
    data.diagnosis?.icd10,
    data.diagnosis?.diagnosisGroup,
    data.therapy?.primaryRemedy,
    data.therapy?.units
  ]
  
  const allRequiredPresent = requiredFields.every(f => f !== undefined && f !== null)
  if (!allRequiredPresent) return false
  
  return true
}

/**
 * Helper: Parse German date format (DD.MM.YYYY)
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

/**
 * Helper: Group appointments by week
 */
function groupByWeek(appointments: Array<{ date: string }>): Record<string, Array<{ date: string }>> {
  const grouped: Record<string, Array<{ date: string }>> = {}
  
  appointments.forEach(apt => {
    const date = new Date(apt.date)
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`
    if (!grouped[weekKey]) {
      grouped[weekKey] = []
    }
    grouped[weekKey].push(apt)
  })
  
  return grouped
}

/**
 * Helper: Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}


