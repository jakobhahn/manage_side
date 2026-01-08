-- Add tip_amount column to payment_transactions table
ALTER TABLE public.payment_transactions
ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;

-- Create index for efficient tip queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tip_amount ON public.payment_transactions(tip_amount) WHERE tip_amount > 0;

-- Add comment for documentation
COMMENT ON COLUMN public.payment_transactions.tip_amount IS 'Tip amount extracted from SumUp transaction data';





