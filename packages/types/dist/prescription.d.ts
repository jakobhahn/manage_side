/**
 * Types for prescription validation (GKV Muster 13)
 */
export type PrescriptionSource = 'BARCODE' | 'OCR';
export interface InsurerData {
    name?: string;
    ik?: string;
}
export interface PatientData {
    firstName?: string;
    lastName?: string;
    dob?: string;
    insuranceNo?: string;
}
export interface PrescriberData {
    name?: string;
    lanr?: string;
    bsnr?: string;
    signaturePresent?: boolean;
    stampPresent?: boolean;
    issueDate?: string;
}
export interface DiagnosisData {
    icd10?: string;
    diagnosisGroup?: string;
    freeText?: string;
}
export interface TherapyData {
    area?: 'PHYSIO';
    primaryRemedy?: string;
    secondaryRemedy?: string;
    units?: number;
    frequency?: string;
    urgent?: boolean;
    homeVisit?: boolean;
}
export interface PrescriptionData {
    insurer?: InsurerData;
    patient?: PatientData;
    prescriber?: PrescriberData;
    diagnosis?: DiagnosisData;
    therapy?: TherapyData;
    rawSource: PrescriptionSource;
    confidence?: Record<string, number>;
}
export type ValidationLevel = 'OK' | 'WARN' | 'FEHLER';
export type ValidationPhase = 'PRE' | 'DURING' | 'POST';
export interface ValidationCheck {
    code: string;
    phase: ValidationPhase;
    level: ValidationLevel;
    message: string;
    field?: string;
}
export interface ValidationResult {
    status: ValidationLevel;
    source: PrescriptionSource;
    data: PrescriptionData;
    checks: ValidationCheck[];
    billingReady: boolean;
}
export interface PrescriptionContext {
    organizationId: string;
    userId?: string;
    patientId?: string;
    existingPrescriptions?: Array<{
        id: string;
        issueDate: string;
        therapy?: TherapyData;
        diagnosis?: DiagnosisData;
    }>;
    appointments?: Array<{
        date: string;
        therapy?: TherapyData;
    }>;
}
//# sourceMappingURL=prescription.d.ts.map