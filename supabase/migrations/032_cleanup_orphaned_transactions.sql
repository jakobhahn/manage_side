-- Cleanup orphaned payment_transactions without organization_id
-- This migration removes duplicate entries that were created without organization_id
-- and keeps only the entries with organization_id set

-- First, identify and log orphaned transactions
DO $$
DECLARE
    orphaned_count INTEGER;
    duplicate_count INTEGER;
BEGIN
    -- Count orphaned transactions (without organization_id)
    SELECT COUNT(*) INTO orphaned_count
    FROM public.payment_transactions
    WHERE organization_id IS NULL;
    
    RAISE NOTICE 'Found % orphaned transactions (without organization_id)', orphaned_count;
    
    -- Count transactions that have both orphaned and valid entries
    SELECT COUNT(DISTINCT t1.transaction_id) INTO duplicate_count
    FROM public.payment_transactions t1
    WHERE t1.organization_id IS NULL
    AND EXISTS (
        SELECT 1
        FROM public.payment_transactions t2
        WHERE t2.transaction_id = t1.transaction_id
        AND t2.organization_id IS NOT NULL
    );
    
    RAISE NOTICE 'Found % transaction_ids with both orphaned and valid entries', duplicate_count;
END $$;

-- Delete orphaned transactions that have a valid entry with organization_id
-- Keep the ones with organization_id, delete the ones without
DELETE FROM public.payment_transactions
WHERE organization_id IS NULL
AND transaction_id IN (
    SELECT DISTINCT transaction_id
    FROM public.payment_transactions
    WHERE organization_id IS NOT NULL
);

-- For orphaned transactions without any valid entry, we can't determine the organization
-- So we'll delete them as they're not useful without organization_id
-- (This is safe because they can't be queried via RLS anyway)
DELETE FROM public.payment_transactions
WHERE organization_id IS NULL;

-- Add a NOT NULL constraint to organization_id to prevent future orphaned entries
-- But first, we need to ensure all existing entries have organization_id
-- (We just deleted all NULL entries, so this should be safe)
ALTER TABLE public.payment_transactions
ALTER COLUMN organization_id SET NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON COLUMN public.payment_transactions.organization_id IS 'Required: All transactions must belong to an organization. This prevents orphaned entries.';



