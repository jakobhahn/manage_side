-- Add employment_type field to users table for employment classification
-- Run this SQL in your Supabase Studio SQL Editor or via psql

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) CHECK (employment_type IN ('mini', 'teilzeit', 'vollzeit', 'werkstudent') OR employment_type IS NULL);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_employment_type ON public.users(employment_type);

-- Add comment for documentation
COMMENT ON COLUMN public.users.employment_type IS 'Employment type: mini (Minijob), teilzeit (Part-time), vollzeit (Full-time), werkstudent (Working student)';

