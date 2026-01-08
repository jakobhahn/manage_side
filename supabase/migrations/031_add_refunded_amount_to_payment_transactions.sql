-- Add refunded_amount and net_amount columns to payment_transactions table
ALTER TABLE public.payment_transactions
ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2);

-- Update net_amount for existing successful transactions (amount - refunded_amount)
UPDATE public.payment_transactions
SET net_amount = amount - COALESCE(refunded_amount, 0)
WHERE status = 'SUCCESSFUL' OR status = 'PARTIALLY_REFUNDED';

-- Create indexes for efficient refund queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_refunded_amount ON public.payment_transactions(refunded_amount) WHERE refunded_amount > 0;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_net_amount ON public.payment_transactions(net_amount);

-- Add comments for documentation
COMMENT ON COLUMN public.payment_transactions.refunded_amount IS 'Amount that was refunded for this transaction (0 if no refund)';
COMMENT ON COLUMN public.payment_transactions.net_amount IS 'Net amount of the transaction (amount - refunded_amount)';

