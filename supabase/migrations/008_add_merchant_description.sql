-- Add description field to merchant_codes table
ALTER TABLE public.merchant_codes 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing records to use merchant_name as description if description is null
UPDATE public.merchant_codes 
SET description = COALESCE(merchant_name, merchant_code)
WHERE description IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.merchant_codes.description IS 'User-friendly description for the merchant account';

