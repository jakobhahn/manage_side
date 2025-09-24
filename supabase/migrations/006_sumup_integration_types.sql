-- Add integration type enum for SumUp
CREATE TYPE integration_type AS ENUM ('oauth', 'api_key');

-- Add new columns to merchant_codes table for different integration types
ALTER TABLE public.merchant_codes 
ADD COLUMN integration_type integration_type DEFAULT 'api_key',
ADD COLUMN oauth_client_id VARCHAR(255),
ADD COLUMN oauth_client_secret_encrypted TEXT,
ADD COLUMN oauth_access_token_encrypted TEXT,
ADD COLUMN oauth_refresh_token_encrypted TEXT,
ADD COLUMN oauth_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Update RLS policies for new columns
DROP POLICY IF EXISTS "Users can view merchant codes for their organization" ON public.merchant_codes;
DROP POLICY IF EXISTS "Users can insert merchant codes for their organization" ON public.merchant_codes;
DROP POLICY IF EXISTS "Users can update merchant codes for their organization" ON public.merchant_codes;
DROP POLICY IF EXISTS "Users can delete merchant codes for their organization" ON public.merchant_codes;

-- Recreate RLS policies with new columns
CREATE POLICY "Users can view merchant codes for their organization" ON public.merchant_codes
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert merchant codes for their organization" ON public.merchant_codes
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Users can update merchant codes for their organization" ON public.merchant_codes
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Users can delete merchant codes for their organization" ON public.merchant_codes
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Add comments for documentation
COMMENT ON COLUMN public.merchant_codes.integration_type IS 'Type of SumUp integration: oauth or api_key';
COMMENT ON COLUMN public.merchant_codes.oauth_client_id IS 'OAuth client ID for SumUp OAuth integration';
COMMENT ON COLUMN public.merchant_codes.oauth_client_secret_encrypted IS 'Encrypted OAuth client secret';
COMMENT ON COLUMN public.merchant_codes.oauth_access_token_encrypted IS 'Encrypted OAuth access token';
COMMENT ON COLUMN public.merchant_codes.oauth_refresh_token_encrypted IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN public.merchant_codes.oauth_token_expires_at IS 'OAuth token expiration timestamp';
COMMENT ON COLUMN public.merchant_codes.api_key_encrypted IS 'Encrypted API key for API key integration';
COMMENT ON COLUMN public.merchant_codes.api_secret_encrypted IS 'Encrypted API secret for API key integration';
COMMENT ON COLUMN public.merchant_codes.encryption_salt IS 'Salt used for encryption of sensitive data';
