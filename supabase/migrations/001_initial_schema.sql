-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium', 'enterprise');
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

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  subscription_tier subscription_tier DEFAULT 'free',
  billing_email VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'Europe/Berlin',
  currency VARCHAR(3) DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchant codes table (for SumUp integration)
CREATE TABLE public.merchant_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  merchant_code VARCHAR(100) NOT NULL,
  merchant_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, merchant_code)
);

-- Module subscriptions table
CREATE TABLE public.module_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_name module_name NOT NULL,
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, module_name)
);

-- Payment transactions table (from SumUp)
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(50) NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  merchant_code VARCHAR(100),
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, transaction_id)
);

-- Revenue analytics table (aggregated data)
CREATE TABLE public.revenue_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  transaction_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, period_type, period_start)
);

-- Enable Row Level Security
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations table
CREATE POLICY "Organizations are viewable by their members." ON public.organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "Organization owners can insert organizations." ON public.organizations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'owner')
  );
CREATE POLICY "Organization owners can update organizations." ON public.organizations
  FOR UPDATE USING (
    id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
  );
CREATE POLICY "Organization owners can delete organizations." ON public.organizations
  FOR DELETE USING (
    id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
  );

-- RLS Policies for users table
CREATE POLICY "Users can view their own organization's users." ON public.users
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "Organization owners/managers can insert users." ON public.users
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager') LIMIT 1)
  );
CREATE POLICY "Organization owners/managers can update users." ON public.users
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager') LIMIT 1)
  );
CREATE POLICY "Organization owners/managers can delete users." ON public.users
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager') LIMIT 1)
  );

-- RLS Policies for merchant_codes table
CREATE POLICY "Merchant codes are viewable by their organization members." ON public.merchant_codes
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "Organization owners/managers can insert merchant codes." ON public.merchant_codes
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager') LIMIT 1)
  );
CREATE POLICY "Organization owners/managers can update merchant codes." ON public.merchant_codes
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager') LIMIT 1)
  );
CREATE POLICY "Organization owners/managers can delete merchant codes." ON public.merchant_codes
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND (role = 'owner' OR role = 'manager') LIMIT 1)
  );

-- RLS Policies for payment_transactions table
CREATE POLICY "Payment transactions are viewable by their organization members." ON public.payment_transactions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );
-- Allow n8n to insert transactions (via service role or specific function)
-- For now, we'll allow authenticated users to insert, but this should be restricted to n8n/backend service
CREATE POLICY "Authenticated users can insert payment transactions for their organization." ON public.payment_transactions
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- RLS Policies for revenue_analytics table
CREATE POLICY "Revenue analytics are viewable by their organization members." ON public.revenue_analytics
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );
-- Allow the update_revenue_analytics function to insert/update
CREATE POLICY "Revenue analytics can be inserted/updated by the revenue analytics function." ON public.revenue_analytics
  FOR INSERT WITH CHECK (true); -- This will be refined with a specific function role later
CREATE POLICY "Revenue analytics can be updated by the revenue analytics function." ON public.revenue_analytics
  FOR UPDATE USING (true); -- This will be refined with a specific function role later

-- RLS Policies for module_subscriptions table
CREATE POLICY "Module subscriptions are viewable by their organization members." ON public.module_subscriptions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "Organization owners can insert module subscriptions." ON public.module_subscriptions
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
  );
CREATE POLICY "Organization owners can update module subscriptions." ON public.module_subscriptions
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
  );
CREATE POLICY "Organization owners can delete module subscriptions." ON public.module_subscriptions
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM public.users WHERE auth_id = auth.uid() AND role = 'owner' LIMIT 1)
  );

-- Create indexes for better performance
CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_organization_id ON public.users(organization_id);
CREATE INDEX idx_merchant_codes_organization_id ON public.merchant_codes(organization_id);
CREATE INDEX idx_module_subscriptions_organization_id ON public.module_subscriptions(organization_id);
CREATE INDEX idx_payment_transactions_organization_id ON public.payment_transactions(organization_id);
CREATE INDEX idx_payment_transactions_transaction_date ON public.payment_transactions(transaction_date);
CREATE INDEX idx_revenue_analytics_organization_id ON public.revenue_analytics(organization_id);
CREATE INDEX idx_revenue_analytics_period ON public.revenue_analytics(organization_id, period_type, period_start);