-- Function to create organization with owner
CREATE OR REPLACE FUNCTION create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  owner_email TEXT,
  owner_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
  user_id UUID;
BEGIN
  -- Create the organization
  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO org_id;

  -- Get the user ID from auth.users by email
  SELECT id INTO user_id FROM auth.users WHERE email = owner_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', owner_email;
  END IF;

  -- Create the user profile in public.users
  INSERT INTO users (auth_id, organization_id, name, email, role)
  VALUES (user_id, org_id, owner_name, owner_email, 'owner');

  -- Create default module subscriptions for the organization
  INSERT INTO module_subscriptions (organization_id, module_name, is_active)
  VALUES 
    (org_id, 'revenue_analytics', true),
    (org_id, 'kpi_dashboard', true);

  RETURN org_id;
END;
$$;
