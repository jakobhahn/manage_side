-- Add encryption fields to merchant_codes table
ALTER TABLE merchant_codes 
ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS api_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS encryption_salt TEXT,
ADD COLUMN IF NOT EXISTS is_webhook_configured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'inactive' CHECK (sync_status IN ('active', 'inactive', 'error', 'syncing'));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_merchant_codes_organization_active 
ON merchant_codes(organization_id, is_active);

-- Add RLS policy for merchant codes (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'merchant_codes' 
        AND policyname = 'merchant_codes_policy'
    ) THEN
        CREATE POLICY merchant_codes_policy ON merchant_codes
        FOR ALL USING (
            organization_id IN (
                SELECT organization_id 
                FROM users 
                WHERE auth_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Create function to generate encryption salt
CREATE OR REPLACE FUNCTION generate_encryption_salt()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to encrypt API credentials
CREATE OR REPLACE FUNCTION encrypt_api_credentials(
    api_key TEXT,
    api_secret TEXT,
    salt TEXT
)
RETURNS TABLE(encrypted_key TEXT, encrypted_secret TEXT) AS $$
BEGIN
    -- In a real implementation, you would use proper encryption here
    -- For now, we'll use a simple base64 encoding as placeholder
    -- In production, use pgcrypto with AES encryption
    RETURN QUERY SELECT 
        encode(api_key::bytea, 'base64') as encrypted_key,
        encode(api_secret::bytea, 'base64') as encrypted_secret;
END;
$$ LANGUAGE plpgsql;

-- Create function to decrypt API credentials
CREATE OR REPLACE FUNCTION decrypt_api_credentials(
    encrypted_key TEXT,
    encrypted_secret TEXT
)
RETURNS TABLE(api_key TEXT, api_secret TEXT) AS $$
BEGIN
    -- In a real implementation, you would use proper decryption here
    -- For now, we'll use a simple base64 decoding as placeholder
    -- In production, use pgcrypto with AES decryption
    RETURN QUERY SELECT 
        convert_from(decode(encrypted_key, 'base64'), 'UTF8') as api_key,
        convert_from(decode(encrypted_secret, 'base64'), 'UTF8') as api_secret;
END;
$$ LANGUAGE plpgsql;
