-- Update existing transactions to extract tip_amount from raw_data
-- This is a one-time update for existing transactions

-- Function to extract tip from JSONB raw_data
CREATE OR REPLACE FUNCTION extract_tip_from_raw_data(raw_data JSONB)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  tip_value DECIMAL(10,2) := 0;
BEGIN
  -- Try different possible locations for tip in the JSON
  -- First check tip_amount (official SumUp API field)
  IF raw_data ? 'tip_amount' THEN
    tip_value := COALESCE((raw_data->>'tip_amount')::DECIMAL, 0);
  ELSIF raw_data ? 'tip' THEN
    tip_value := COALESCE((raw_data->>'tip')::DECIMAL, 0);
  ELSIF raw_data ? 'tips' THEN
    -- Check nested tips object
    IF raw_data->'tips' ? 'amount' THEN
      tip_value := COALESCE((raw_data->'tips'->>'amount')::DECIMAL, 0);
    ELSIF raw_data->'tips' ? 'tip_amount' THEN
      tip_value := COALESCE((raw_data->'tips'->>'tip_amount')::DECIMAL, 0);
    ELSIF raw_data->'tips' ? 'total' THEN
      tip_value := COALESCE((raw_data->'tips'->>'total')::DECIMAL, 0);
    END IF;
  -- Check transaction_data object
  ELSIF raw_data ? 'transaction_data' THEN
    IF raw_data->'transaction_data' ? 'tip_amount' THEN
      tip_value := COALESCE((raw_data->'transaction_data'->>'tip_amount')::DECIMAL, 0);
    ELSIF raw_data->'transaction_data' ? 'tip' THEN
      tip_value := COALESCE((raw_data->'transaction_data'->>'tip')::DECIMAL, 0);
    END IF;
  -- Check receipt_data object
  ELSIF raw_data ? 'receipt_data' THEN
    IF raw_data->'receipt_data' ? 'tip_amount' THEN
      tip_value := COALESCE((raw_data->'receipt_data'->>'tip_amount')::DECIMAL, 0);
    ELSIF raw_data->'receipt_data' ? 'tip' THEN
      tip_value := COALESCE((raw_data->'receipt_data'->>'tip')::DECIMAL, 0);
    END IF;
  END IF;
  
  RETURN GREATEST(tip_value, 0); -- Ensure non-negative
END;
$$ LANGUAGE plpgsql;

-- Update all existing transactions where tip_amount is NULL or 0
UPDATE public.payment_transactions
SET tip_amount = extract_tip_from_raw_data(raw_data)
WHERE (tip_amount IS NULL OR tip_amount = 0)
  AND raw_data IS NOT NULL;

-- Clean up the function (optional, can be kept for future use)
-- DROP FUNCTION IF EXISTS extract_tip_from_raw_data(JSONB);

