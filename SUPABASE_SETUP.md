# Supabase Setup Guide for AnnotatePro AI

This guide will help you set up Supabase as the database backend for AnnotatePro AI.

## Prerequisites

- Node.js and npm installed
- A Supabase account (free tier available at https://supabase.com)

## Step 1: Install Dependencies

Due to PowerShell execution policy restrictions, you may need to run this command in an elevated PowerShell or use Command Prompt:

```bash
npm install @supabase/supabase-js
```

**Alternative**: If you encounter permission issues, run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then run the npm install command again.

## Step 2: Create a Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in:
   - **Project name**: annotatepro-ai (or your preferred name)
   - **Database password**: Choose a strong password
   - **Region**: Select closest to your location
4. Click "Create new project" and wait for setup to complete (~2 minutes)

## Step 3: Get Your Supabase Credentials

1. In your Supabase project dashboard, click on the **Settings** icon (gear) in the left sidebar
2. Click on **API** under Project Settings
3. You'll see two important values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: A long string starting with `eyJ...`

## Step 4: Create Environment File

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Open `.env` and replace the placeholders with your actual values:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

⚠️ **IMPORTANT**: Never commit `.env` to git. It's already in `.gitignore`.

## Step 5: Run the Database Schema

1. In your Supabase project dashboard, click on the **SQL Editor** icon in the left sidebar
2. Click **New Query**
3. Open the file `supabase-schema.sql` in this project
4. Copy the entire contents and paste it into the Supabase SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" - this is expected!

## Step 6: Verify Database Setup

1. Click on **Table Editor** in the left sidebar
2. You should see the following tables:
   - users
   - projects
   - tasks
   - task_submissions
   - annotations
   - image_annotations
   - project_assignments
   - task_assignments

## Step 7: Configure Authentication

1. Click on **Authentication** in the left sidebar
2. Click on **Providers**
3. Ensure **Email** provider is enabled (it should be by default)
4. Under **Email Auth** settings:
   - Enable "Confirm email" if you want email verification
   - Or disable it for easier testing

## Step 8: Test the Application

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the application in your browser
3. Try to register a new account
4. The user should be created in Supabase (check Authentication > Users)
5. A corresponding profile should be created in the `users` table

## Step 9: Create Your First Admin User

After registering your first user:

1. Go to Supabase **Table Editor**
2. Click on the **users** table
3. Find your user and click to edit
4. Change the `role` field from `annotator` to `admin`
5. Click **Save**

Now you have admin access in the application!

## Troubleshooting

### "Supabase not initialized" error
- Check that your `.env` file exists and has the correct values
- Restart your development server after creating/modifying `.env`

### Authentication errors
- Verify your Supabase URL and anon key are correct
- Check that the Email provider is enabled in Supabase Authentication settings

### Database errors
- Ensure you ran the entire `supabase-schema.sql` script
- Check the Supabase logs in Dashboard > Logs

### RLS (Row Level Security) issues
- The schema includes RLS policies
- Admins can see all data
- Regular users can only see their own annotations
- If you need to modify policies, go to Authentication > Policies

## Data Migration from localStorage

The application currently uses localStorage. To migrate existing data:

1. Export your data using the admin dashboard's export feature
2. The data will be in JSON format
3. You can import it back through the admin interface
4. Or manually insert it into Supabase tables using the Table Editor

## Next Steps

- Set up proper email templates in Supabase Authentication > Email Templates
- Configure custom SMTP for production (optional)
- Set up database backups (automatic in Supabase)
- Consider upgrading to Supabase Pro for production use

## Security Notes

- ✅ `.env` is in `.gitignore` - never commit it
- ✅ Row Level Security (RLS) is enabled on all tables
- ✅ Users can only access their own data
- ✅ Admins have elevated permissions
- ⚠️ The anon key is safe to expose in client-side code
- ⚠️ Never expose your service_role key in client code

## Support

- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Project Issues: Create an issue in your repository
