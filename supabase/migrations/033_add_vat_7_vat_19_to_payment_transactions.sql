-- Add vat_7 and vat_19 columns to payment_transactions table
ALTER TABLE public.payment_transactions
ADD COLUMN IF NOT EXISTS vat_7 DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_19 DECIMAL(10,2) DEFAULT 0;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_vat_7 ON public.payment_transactions(vat_7) WHERE vat_7 > 0;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_vat_19 ON public.payment_transactions(vat_19) WHERE vat_19 > 0;

-- Add comments for documentation
COMMENT ON COLUMN public.payment_transactions.vat_7 IS 'VAT amount at 7% rate for this transaction';
COMMENT ON COLUMN public.payment_transactions.vat_19 IS 'VAT amount at 19% rate for this transaction';



