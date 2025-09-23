-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Organizations are viewable by their members." ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can insert organizations." ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update organizations." ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can delete organizations." ON public.organizations;

DROP POLICY IF EXISTS "Users can view their own organization's users." ON public.users;
DROP POLICY IF EXISTS "Organization owners/managers can insert users." ON public.users;
DROP POLICY IF EXISTS "Organization owners/managers can update users." ON public.users;
DROP POLICY IF EXISTS "Organization owners/managers can delete users." ON public.users;

DROP POLICY IF EXISTS "Merchant codes are viewable by their organization members." ON public.merchant_codes;
DROP POLICY IF EXISTS "Organization owners/managers can insert merchant codes." ON public.merchant_codes;
DROP POLICY IF EXISTS "Organization owners/managers can update merchant codes." ON public.merchant_codes;
DROP POLICY IF EXISTS "Organization owners/managers can delete merchant codes." ON public.merchant_codes;

DROP POLICY IF EXISTS "Module subscriptions are viewable by their organization members." ON public.module_subscriptions;
DROP POLICY IF EXISTS "Organization owners can insert module subscriptions." ON public.module_subscriptions;
DROP POLICY IF EXISTS "Organization owners can update module subscriptions." ON public.module_subscriptions;
DROP POLICY IF EXISTS "Organization owners can delete module subscriptions." ON public.module_subscriptions;

DROP POLICY IF EXISTS "Payment transactions are viewable by their organization members." ON public.payment_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert payment transactions for their organization." ON public.payment_transactions;

DROP POLICY IF EXISTS "Revenue analytics are viewable by their organization members." ON public.revenue_analytics;
DROP POLICY IF EXISTS "Revenue analytics can be inserted/updated by the revenue analytics function." ON public.revenue_analytics;
DROP POLICY IF EXISTS "Revenue analytics can be updated by the revenue analytics function." ON public.revenue_analytics;

-- Create a function to get the current user's organization_id
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organization_id INTO org_id 
    FROM public.users 
    WHERE auth_id = auth.uid() 
    LIMIT 1;
    
    RETURN org_id;
END;
$$;

-- Create simplified RLS policies using the function
-- Organizations
CREATE POLICY "Users can view their organization" ON public.organizations
  FOR SELECT USING (id = get_user_organization_id());

CREATE POLICY "Users can insert organizations" ON public.organizations
  FOR INSERT WITH CHECK (true); -- Allow all authenticated users to create organizations

CREATE POLICY "Organization owners can update their organization" ON public.organizations
  FOR UPDATE USING (id = get_user_organization_id());

CREATE POLICY "Organization owners can delete their organization" ON public.organizations
  FOR DELETE USING (id = get_user_organization_id());

-- Users
CREATE POLICY "Users can view their organization's users" ON public.users
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert users in their organization" ON public.users
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update users in their organization" ON public.users
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete users in their organization" ON public.users
  FOR DELETE USING (organization_id = get_user_organization_id());

-- Merchant codes
CREATE POLICY "Users can view their organization's merchant codes" ON public.merchant_codes
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert merchant codes in their organization" ON public.merchant_codes
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update merchant codes in their organization" ON public.merchant_codes
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete merchant codes in their organization" ON public.merchant_codes
  FOR DELETE USING (organization_id = get_user_organization_id());

-- Module subscriptions
CREATE POLICY "Users can view their organization's module subscriptions" ON public.module_subscriptions
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert module subscriptions in their organization" ON public.module_subscriptions
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update module subscriptions in their organization" ON public.module_subscriptions
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete module subscriptions in their organization" ON public.module_subscriptions
  FOR DELETE USING (organization_id = get_user_organization_id());

-- Payment transactions
CREATE POLICY "Users can view their organization's payment transactions" ON public.payment_transactions
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert payment transactions in their organization" ON public.payment_transactions
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- Revenue analytics
CREATE POLICY "Users can view their organization's revenue analytics" ON public.revenue_analytics
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert/update revenue analytics" ON public.revenue_analytics
  FOR ALL USING (true); -- Allow system functions to insert/update
