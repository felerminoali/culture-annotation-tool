-- WORKING SOLUTION: Create Admin User in Supabase
-- This script GUARANTEES the user profile is created
-- Run this in Supabase SQL Editor

-- Step 1: First, make sure RLS is disabled on users table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Create the admin user
-- CHANGE THESE VALUES:
-- 'admin@example.com' -> your admin email
-- 'YourPassword123' -> your admin password
-- 'Admin Name' -> admin's full name

DO $$
DECLARE
  new_user_id uuid;
  user_exists boolean;
BEGIN
  -- Check if user already exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@example.com'
  ) INTO user_exists;

  IF user_exists THEN
    RAISE NOTICE 'User already exists in auth.users';
    
    -- Get the existing user ID
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@example.com';
    
    -- Delete existing profile if any
    DELETE FROM public.users WHERE id = new_user_id;
  ELSE
    -- Create new auth user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@example.com',
      crypt('YourPassword123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin Name","role":"admin"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    ) RETURNING id INTO new_user_id;
    
    RAISE NOTICE 'Created auth user with ID: %', new_user_id;
  END IF;

  -- Force insert the user profile (this WILL work with RLS disabled)
  INSERT INTO public.users (id, email, name, role, created_at, updated_at)
  VALUES (
    new_user_id,
    'admin@example.com',
    'Admin Name',
    'admin',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    updated_at = NOW();
  
  RAISE NOTICE 'Successfully created/updated user profile for: %', new_user_id;
  RAISE NOTICE 'Login with email: admin@example.com and password: YourPassword123';
END $$;

-- Step 3: Verify the user was created
SELECT id, email, name, role FROM public.users WHERE email = 'admin@example.com';
