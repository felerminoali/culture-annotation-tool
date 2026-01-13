# Disable Email Confirmation for Annotators

Follow these steps to allow annotators to sign up without email confirmation:

## Step 1: Configure Supabase Authentication Settings

1. Go to your **Supabase Dashboard**
2. Click **Authentication** in the left sidebar
3. Click **Settings** (or **Providers**)
4. Scroll down to **Email** section
5. Find **"Confirm email"** setting
6. **Uncheck** or **Disable** this option
7. Click **Save**

## Step 2: Verify the Code Update

The code has been updated in `services/supabaseService.ts` to support auto-confirmation. No additional code changes needed!

## Step 3: Test Registration

1. Go to your app signup page
2. Register a new annotator user
3. User should be able to login **immediately** without checking email
4. No confirmation email will be sent

## What This Does

✅ **Before:**
- User signs up
- Receives confirmation email
- Must click link to activate account
- Can then login

✅ **After:**
- User signs up
- Account is **immediately active**
- Can login right away
- No email confirmation needed

## Security Note

This is appropriate for annotators because:
- They don't have admin privileges
- Admins are created manually in Supabase (more secure)
- Simplifies onboarding for annotators
- Reduces friction in the signup process

## If You Want Email Confirmation Later

To re-enable email confirmation:
1. Go to Supabase Dashboard → Authentication → Settings
2. Check "Confirm email"
3. Save

The code will automatically adapt to the Supabase setting.

## Troubleshooting

### "Email not confirmed" error
- Make sure you disabled "Confirm email" in Supabase settings
- Restart your dev server after changing Supabase settings

### Users still receiving confirmation emails
- Check Supabase Authentication → Settings → Email
- Ensure "Confirm email" is disabled
- May take a few minutes for settings to propagate
