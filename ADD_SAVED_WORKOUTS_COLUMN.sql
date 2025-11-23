-- =================================================================
-- ADD SAVED_WORKOUTS COLUMN TO PROFILES
-- =================================================================
-- Generated: 2025-11-23
-- Purpose: Add the missing saved_workouts column to profiles table
-- Run this in Supabase SQL Editor for your production database
-- =================================================================

BEGIN;

-- Add saved_workouts column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS saved_workouts TEXT[] NOT NULL DEFAULT '{}';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'saved_workouts';

COMMIT;

-- Expected output:
-- column_name     | data_type | is_nullable | column_default
-- ----------------+-----------+-------------+----------------
-- saved_workouts  | ARRAY     | NO          | '{}'::text[]
