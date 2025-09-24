-- Seed data for Hans Restaurant App
-- This file is automatically executed after database reset

-- Create test organization: Joschi Pizza Bistro
INSERT INTO public.organizations (id, name, slug, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Joschi Pizza Bistro',
  'joschi-pizza-bistro',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create test user in auth.users (this would normally be done via Supabase Auth)
-- Note: In a real scenario, this would be created via the signup API
-- For seeding purposes, we'll create a placeholder that gets updated when the user signs up

-- Note: User profile will be created when user signs up and links to organization
-- This is handled by the link-organization API

-- Create default module subscriptions for the organization
INSERT INTO public.module_subscriptions (organization_id, module_name, is_active, subscribed_at, created_at, updated_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'revenue_analytics', true, NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440000', 'kpi_dashboard', true, NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440000', 'shift_planning', true, NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440000', 'inventory_management', true, NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440000', 'time_clock', true, NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440000', 'sales_management', true, NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440000', 'reporting', true, NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440000', 'menu_management', true, NOW(), NOW(), NOW())
ON CONFLICT (organization_id, module_name) DO NOTHING;

-- Create sample merchant codes for testing
INSERT INTO public.merchant_codes (
  id,
  organization_id,
  merchant_code,
  merchant_name,
  integration_type,
  is_active, 
  sync_status,
  created_at, 
  updated_at
)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440000',
    'JOSCHI001',
    'Joschi Pizza Bistro - Hauptstandort',
    'api_key',
    true,
    'inactive',
    NOW(),
    NOW()
  ),
  (
    '550e8400-e29b-41d4-a716-446655440011',
    '550e8400-e29b-41d4-a716-446655440000',
    'JOSCHI002',
    'Joschi Pizza Bistro - Lieferung',
    'oauth',
    true,
    'inactive',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Create sample payment transactions for testing
INSERT INTO public.payment_transactions (
  id,
  organization_id,
  transaction_id,
  merchant_code,
  amount,
  currency,
  transaction_date,
  status,
  raw_data,
  created_at,
  updated_at
)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440020',
    '550e8400-e29b-41d4-a716-446655440000',
    'TXN001',
    'JOSCHI001',
    25.50,
    'EUR',
    NOW() - INTERVAL '1 hour',
    'completed',
    '{"payment_method": "card", "card_type": "visa", "last_four": "1234"}',
    NOW(),
    NOW()
  ),
  (
    '550e8400-e29b-41d4-a716-446655440021',
    '550e8400-e29b-41d4-a716-446655440000',
    'TXN002',
    'JOSCHI001',
    18.75,
    'EUR',
    NOW() - INTERVAL '2 hours',
    'completed',
    '{"payment_method": "card", "card_type": "mastercard", "last_four": "5678"}',
    NOW(),
    NOW()
  ),
  (
    '550e8400-e29b-41d4-a716-446655440022',
    '550e8400-e29b-41d4-a716-446655440000',
    'TXN003',
    'JOSCHI002',
    32.00,
    'EUR',
    NOW() - INTERVAL '3 hours',
    'completed',
    '{"payment_method": "card", "card_type": "visa", "last_four": "9012"}',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Create sample revenue analytics data
INSERT INTO public.revenue_analytics (
  id,
  organization_id,
  period_type,
  period_start,
  total_revenue,
  transaction_count,
  created_at,
  updated_at
)
VALUES 
  -- Today's data
  (
    '550e8400-e29b-41d4-a716-446655440030',
    '550e8400-e29b-41d4-a716-446655440000',
    'daily',
    CURRENT_DATE,
    76.25,
    3,
    NOW(),
    NOW()
  ),
  -- This week's data
  (
    '550e8400-e29b-41d4-a716-446655440031',
    '550e8400-e29b-41d4-a716-446655440000',
    'weekly',
    DATE_TRUNC('week', CURRENT_DATE)::date,
    450.75,
    18,
    NOW(),
    NOW()
  ),
  -- This month's data
  (
    '550e8400-e29b-41d4-a716-446655440032',
    '550e8400-e29b-41d4-a716-446655440000',
    'monthly',
    DATE_TRUNC('month', CURRENT_DATE)::date,
    1850.50,
    72,
    NOW(),
    NOW()
  )
ON CONFLICT (organization_id, period_type, period_start) DO NOTHING;

-- Create additional test users for the organization
INSERT INTO public.users (id, auth_id, organization_id, name, email, role, created_at, updated_at)
VALUES 
  (
    '550e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440000',
    'Maria Schmidt',
    'maria@joschi-pizza.de',
    'manager',
    NOW(),
    NOW()
  ),
  (
    '550e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440006',
    '550e8400-e29b-41d4-a716-446655440000',
    'Tom Weber',
    'tom@joschi-pizza.de',
    'staff',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Seed data inserted successfully for Joschi Pizza Bistro';
    RAISE NOTICE 'Test credentials: jakob@klapp.pizza / adminadmin';
    RAISE NOTICE 'Organization: Joschi Pizza Bistro (joschi-pizza-bistro)';
END $$;
