-- Add address field to organizations table for weather API
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.address IS 'Physical address of the organization for weather data and location services';








