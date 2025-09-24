-- Create Test User in Production Supabase
-- Execute this in your Supabase SQL Editor

-- First, create the user in auth.users using Supabase's built-in function
-- Note: This creates a user with email jakob@klapp.pizza and password adminadmin
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '550e8400-e29b-41d4-a716-446655440001',
  'authenticated',
  'authenticated',
  'jakob@klapp.pizza',
  crypt('adminadmin', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Create user profile in public.users table
INSERT INTO public.users (
  id,
  auth_id,
  organization_id,
  name,
  email,
  role,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  'Jakob Hahn',
  'jakob@klapp.pizza',
  'owner',
  NOW(),
  NOW()
) ON CONFLICT (auth_id) DO NOTHING;

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Test user created successfully!';
    RAISE NOTICE 'Email: jakob@klapp.pizza';
    RAISE NOTICE 'Password: adminadmin';
    RAISE NOTICE 'Organization: Joschi Pizza Bistro';
END $$;
