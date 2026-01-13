-- SIMPLE FIX: Disable RLS on users table
-- This is the quickest solution to get your app working
-- Run this in Supabase SQL Editor

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
