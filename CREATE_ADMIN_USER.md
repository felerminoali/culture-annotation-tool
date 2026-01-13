# How to Create Admin Users in Supabase

Since admin users have elevated privileges, they should be created directly in Supabase for security reasons.

## Method 1: Create Admin User in Supabase Dashboard

### Step 1: Create the User in Authentication
1. Go to your Supabase Dashboard
2. Click **Authentication** in the left sidebar
3. Click **Users** tab
4. Click **Add User** button
5. Fill in:
   - **Email**: admin@example.com
   - **Password**: Choose a strong password
   - **Auto Confirm User**: ✅ Check this box
6. Click **Create User**

### Step 2: Add User Profile with Admin Role
1. Go to **Table Editor** in the left sidebar
2. Click on the **users** table
3. Click **Insert** → **Insert row**
4. Fill in:
   - **id**: Copy the user ID from Authentication → Users (the UUID)
   - **email**: Same email as above
   - **name**: Admin Name
   - **role**: `admin` (type this exactly)
5. Click **Save**

---

## Method 2: Create Admin User via SQL (Faster)

### Step 1: Open SQL Editor
1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**

### Step 2: Run This SQL Script

Replace the values with your admin details:

```sql
-- Create admin user
-- REPLACE THESE VALUES:
-- 'admin@example.com' with your admin email
-- 'your-secure-password' with a strong password
-- 'Admin Name' with the admin's name

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create auth user
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
    crypt('your-secure-password', gen_salt('bf')),
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

  -- Create user profile
  INSERT INTO public.users (id, email, name, role)
  VALUES (new_user_id, 'admin@example.com', 'Admin Name', 'admin');
  
  RAISE NOTICE 'Admin user created with ID: %', new_user_id;
END $$;
```

### Step 3: Click Run
- Press **Run** button
- You should see "Success" with the user ID

---

## Method 3: Promote Existing User to Admin

If you already have a user and want to make them admin:

### Via Table Editor:
1. Go to **Table Editor** → **users** table
2. Find the user by email
3. Click on their row to edit
4. Change **role** from `annotator` to `admin`
5. Click **Save**

### Via SQL:
```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'user@example.com';
```

---

## Verify Admin User

1. **Login** to your app with the admin credentials
2. You should see:
   - "Command Center" instead of "Annotator Portal"
   - Admin dashboard with all tabs
   - Ability to create projects and tasks

---

## Security Best Practices

✅ **DO:**
- Create admin users directly in Supabase
- Use strong passwords for admin accounts
- Limit the number of admin users
- Keep admin credentials secure

❌ **DON'T:**
- Allow admin registration through the public signup form
- Share admin credentials
- Use weak passwords for admin accounts

---

## Troubleshooting

### "User already exists" error
- The email is already registered
- Use Method 3 to promote the existing user

### "Cannot login with admin account"
- Verify the user exists in Authentication → Users
- Verify the profile exists in users table with role='admin'
- Check that email_confirmed_at is set in auth.users

### "Still showing as annotator after login"
- Clear browser cache and cookies
- Logout and login again
- Verify the role in users table is exactly 'admin' (lowercase)
