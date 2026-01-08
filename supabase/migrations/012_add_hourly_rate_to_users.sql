-- Add hourly_rate field to users table for employee master data
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2);

-- Add comment for documentation
COMMENT ON COLUMN public.users.hourly_rate IS 'Hourly wage rate for the employee in organization currency';






