-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff', 'admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');
CREATE TYPE module_name AS ENUM (
  'revenue_analytics', 
  'shift_planning', 
  'inventory_management',
  'time_clock', 
  'sales_management', 
  'kpi_dashboard',
  'reporting', 
  'menu_management'
);

-- Organizations table (Tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  subscription_tier subscription_tier DEFAULT 'free',
  billing_email VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'Europe/Berlin',
  currency VARCHAR(3) DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchant codes for SumUp integration per organization
CREATE TABLE merchant_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  sumup_merchant_code VARCHAR(255) NOT NULL,
  sumup_access_token TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, sumup_merchant_code)
);

-- Users table (Staff members)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module subscriptions per organization
CREATE TABLE module_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  module_name module_name NOT NULL,
  is_active BOOLEAN DEFAULT true,
  subscription_tier subscription_tier DEFAULT 'basic',
  features JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, module_name)
);

-- Payment transactions from SumUp
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  merchant_code_id UUID REFERENCES merchant_codes(id) ON DELETE SET NULL,
  sumup_transaction_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  location_id VARCHAR(100),
  device_id VARCHAR(100),
  raw_data JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active);

CREATE INDEX idx_merchant_codes_org_id ON merchant_codes(organization_id);
CREATE INDEX idx_merchant_codes_active ON merchant_codes(is_active);

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_module_subscriptions_org_id ON module_subscriptions(organization_id);
CREATE INDEX idx_module_subscriptions_active ON module_subscriptions(is_active);

CREATE INDEX idx_payment_transactions_org_id ON payment_transactions(organization_id);
CREATE INDEX idx_payment_transactions_date ON payment_transactions(transaction_date);
CREATE INDEX idx_payment_transactions_sumup_id ON payment_transactions(sumup_transaction_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_merchant_code ON payment_transactions(merchant_code_id);

-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Owners can update their organization" ON organizations
  FOR UPDATE USING (
    id = auth.jwt() ->> 'organization_id'::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.organization_id = organizations.id 
      AND users.id = auth.jwt() ->> 'user_id'::text 
      AND users.role = 'owner'
    )
  );

-- RLS Policies for merchant_codes
CREATE POLICY "Users can view organization merchant codes" ON merchant_codes
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Owners can manage merchant codes" ON merchant_codes
  FOR ALL USING (
    organization_id = auth.jwt() ->> 'organization_id'::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.organization_id = merchant_codes.organization_id 
      AND users.id = auth.jwt() ->> 'user_id'::text 
      AND users.role = 'owner'
    )
  );

-- RLS Policies for users
CREATE POLICY "Users can view organization members" ON users
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Owners and managers can manage users" ON users
  FOR ALL USING (
    organization_id = auth.jwt() ->> 'organization_id'::text AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.organization_id = users.organization_id 
      AND u.id = auth.jwt() ->> 'user_id'::text 
      AND u.role IN ('owner', 'manager')
    )
  );

-- RLS Policies for module_subscriptions
CREATE POLICY "Users can view organization subscriptions" ON module_subscriptions
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

CREATE POLICY "Owners can manage subscriptions" ON module_subscriptions
  FOR ALL USING (
    organization_id = auth.jwt() ->> 'organization_id'::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.organization_id = module_subscriptions.organization_id 
      AND users.id = auth.jwt() ->> 'user_id'::text 
      AND users.role = 'owner'
    )
  );

-- RLS Policies for payment_transactions
CREATE POLICY "Users can view organization transactions" ON payment_transactions
  FOR SELECT USING (organization_id = auth.jwt() ->> 'organization_id'::text);

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchant_codes_updated_at 
  BEFORE UPDATE ON merchant_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_module_subscriptions_updated_at 
  BEFORE UPDATE ON module_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create organization with owner
CREATE OR REPLACE FUNCTION create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  owner_email TEXT,
  owner_name TEXT
)
RETURNS UUID AS $$
DECLARE
  org_id UUID;
  user_id UUID;
BEGIN
  -- Create organization
  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO org_id;
  
  -- Create owner user
  INSERT INTO users (organization_id, email, name, role)
  VALUES (org_id, owner_email, owner_name, 'owner')
  RETURNING id INTO user_id;
  
  -- Enable basic modules for new organization
  INSERT INTO module_subscriptions (organization_id, module_name, subscription_tier)
  SELECT org_id, module_name, 'basic'
  FROM unnest(ARRAY[
    'revenue_analytics'::module_name,
    'time_clock'::module_name,
    'sales_management'::module_name
  ]) AS module_name;
  
  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization_with_owner TO authenticated;
