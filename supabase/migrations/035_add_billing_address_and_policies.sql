-- Add billing address fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS billing_street VARCHAR(255),
ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100) DEFAULT 'Deutschland',
ADD COLUMN IF NOT EXISTS billing_tax_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS billing_contact_name VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN public.organizations.billing_street IS 'Billing address street and number';
COMMENT ON COLUMN public.organizations.billing_city IS 'Billing address city';
COMMENT ON COLUMN public.organizations.billing_postal_code IS 'Billing address postal code';
COMMENT ON COLUMN public.organizations.billing_country IS 'Billing address country';
COMMENT ON COLUMN public.organizations.billing_tax_id IS 'Tax ID / VAT number for billing';
COMMENT ON COLUMN public.organizations.billing_phone IS 'Billing contact phone number';
COMMENT ON COLUMN public.organizations.billing_contact_name IS 'Billing contact person name';

-- Update RLS policies to allow super_admin to access all organizations
-- Drop existing policies that restrict access
DROP POLICY IF EXISTS "Organizations are viewable by their members." ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can insert organizations." ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update organizations." ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can delete organizations." ON public.organizations;

-- Create new policies that allow super_admin full access
CREATE POLICY "Organizations are viewable by their members or super_admin." ON public.organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Organization owners or super_admin can insert organizations." ON public.organizations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'owner')
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Organization owners or super_admin can update organizations." ON public.organizations
  FOR UPDATE USING (
    id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Organization owners or super_admin can delete organizations." ON public.organizations
  FOR DELETE USING (
    id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

-- Update module_subscriptions policies to allow super_admin to manage modules
DROP POLICY IF EXISTS "Module subscriptions are viewable by their organization members." ON public.module_subscriptions;
DROP POLICY IF EXISTS "Organization owners can insert module subscriptions." ON public.module_subscriptions;
DROP POLICY IF EXISTS "Organization owners can update module subscriptions." ON public.module_subscriptions;
DROP POLICY IF EXISTS "Organization owners can delete module subscriptions." ON public.module_subscriptions;

CREATE POLICY "Module subscriptions are viewable by their organization members or super_admin." ON public.module_subscriptions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Organization owners or super_admin can insert module subscriptions." ON public.module_subscriptions
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Organization owners or super_admin can update module subscriptions." ON public.module_subscriptions
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Organization owners or super_admin can delete module subscriptions." ON public.module_subscriptions
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );


