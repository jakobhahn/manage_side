-- Create Jakob user profile manually
-- This script creates the user profile for jakob@klapp.pizza

-- First, ensure the organization exists
INSERT INTO public.organizations (id, name, slug, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Joschi Pizza Bistro',
  'joschi-pizza-bistro',
  NOW(),
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Create user profile for jakob@klapp.pizza
INSERT INTO public.users (
  id,
  auth_id,
  organization_id,
  name,
  email,
  role,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  au.id,
  '550e8400-e29b-41d4-a716-446655440000', -- Joschi Pizza Bistro organization ID
  'Jakob',
  'jakob@klapp.pizza',
  'owner',
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email = 'jakob@klapp.pizza'
ON CONFLICT (auth_id) DO NOTHING;

-- Show the result
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  o.name as organization_name
FROM public.users u
JOIN public.organizations o ON u.organization_id = o.id
WHERE u.email = 'jakob@klapp.pizza';
