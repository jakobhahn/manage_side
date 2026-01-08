-- Add super_admin role to user_role enum
-- This must be in a separate migration because ALTER TYPE ... ADD VALUE
-- cannot be safely executed in a transaction when the table has existing data
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'super_admin' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'super_admin';
    END IF;
END $$;


