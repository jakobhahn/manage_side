-- Add vat_amount column to payment_transactions table
ALTER TABLE public.payment_transactions
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2) DEFAULT 0;

-- Note: amount already exists, but we'll ensure it's properly stored
-- The amount field should store the total transaction amount

-- Create index for efficient VAT queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_vat_amount ON public.payment_transactions(vat_amount) WHERE vat_amount > 0;

-- Add comment for documentation
COMMENT ON COLUMN public.payment_transactions.vat_amount IS 'VAT amount extracted from SumUp transaction data';





