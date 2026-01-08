-- Add prescription_validation module to module_name ENUM
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'prescription_validation';

-- Create prescriptions table for storing validated prescriptions
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  patient_id UUID, -- Optional: reference to patient if patient management exists
  
  -- Source information
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('BARCODE', 'OCR')),
  image_url TEXT, -- URL to uploaded image if stored
  raw_data JSONB, -- Full extracted data
  
  -- Extracted prescription data
  insurer_name TEXT,
  insurer_ik TEXT,
  patient_first_name TEXT,
  patient_last_name TEXT,
  patient_dob DATE,
  patient_insurance_no TEXT,
  prescriber_name TEXT,
  prescriber_lanr TEXT,
  prescriber_bsnr TEXT,
  prescriber_signature_present BOOLEAN DEFAULT false,
  prescriber_stamp_present BOOLEAN DEFAULT false,
  issue_date DATE,
  icd10_code TEXT,
  diagnosis_group TEXT,
  diagnosis_free_text TEXT,
  therapy_area TEXT,
  primary_remedy TEXT,
  secondary_remedy TEXT,
  units INTEGER,
  frequency TEXT,
  urgent BOOLEAN DEFAULT false,
  home_visit BOOLEAN DEFAULT false,
  
  -- Validation results
  validation_status VARCHAR(20) NOT NULL CHECK (validation_status IN ('OK', 'WARN', 'FEHLER')),
  validation_checks JSONB, -- Array of check results
  billing_ready BOOLEAN DEFAULT false,
  confidence_scores JSONB, -- Confidence scores per field from OCR
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_prescriptions_organization ON public.prescriptions(organization_id);
CREATE INDEX idx_prescriptions_user ON public.prescriptions(user_id);
CREATE INDEX idx_prescriptions_status ON public.prescriptions(validation_status);
CREATE INDEX idx_prescriptions_billing_ready ON public.prescriptions(billing_ready);
CREATE INDEX idx_prescriptions_issue_date ON public.prescriptions(issue_date);

-- Enable Row Level Security
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view prescriptions in their organization
CREATE POLICY "Users can view organization prescriptions" ON public.prescriptions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert prescriptions in their organization
CREATE POLICY "Users can insert prescriptions" ON public.prescriptions
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Managers and owners can update prescriptions
CREATE POLICY "Managers can update prescriptions" ON public.prescriptions
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager')
    )
  );

-- Add comments
COMMENT ON TABLE public.prescriptions IS 'Physiotherapy prescription validations (GKV Muster 13)';
COMMENT ON COLUMN public.prescriptions.source_type IS 'How the data was extracted: BARCODE or OCR';
COMMENT ON COLUMN public.prescriptions.validation_status IS 'Overall validation status: OK, WARN, or FEHLER';
COMMENT ON COLUMN public.prescriptions.validation_checks IS 'Array of individual validation check results';
COMMENT ON COLUMN public.prescriptions.billing_ready IS 'True if prescription is ready for billing';


