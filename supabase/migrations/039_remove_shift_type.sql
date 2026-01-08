-- Remove shift_type column from shifts table
-- First, drop any indexes that might reference it
DROP INDEX IF EXISTS idx_shifts_shift_type;

-- Remove the column
ALTER TABLE public.shifts
DROP COLUMN IF EXISTS shift_type;

-- Drop the ENUM type if it exists (only if no other tables use it)
-- Note: This will fail if other tables reference this type, which is fine
DO $$ 
BEGIN
    DROP TYPE IF EXISTS shift_type;
EXCEPTION
    WHEN OTHERS THEN
        -- Type might be in use elsewhere, ignore error
        NULL;
END $$;


