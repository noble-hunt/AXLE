-- =================================================================
-- PRODUCTION FIX: Add Missing Columns to Match Code Schema
-- =================================================================
-- Generated: 2025-11-21
-- Purpose: Sync production database with Drizzle schema definitions
-- Schema: PUBLIC
-- =================================================================

BEGIN;

-- ===== PROFILES TABLE =====
-- Add missing columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS providers TEXT[] NOT NULL DEFAULT '{}';

-- Rename location columns to match code (if they exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'last_lat'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN last_lat TO latitude;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'last_lon'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN last_lon TO longitude;
  END IF;
END $$;

-- Add AXLE Reports columns (create enum first if needed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_frequency') THEN
    CREATE TYPE report_frequency AS ENUM ('none', 'weekly', 'monthly', 'both');
  END IF;
END $$;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS report_frequency report_frequency NOT NULL DEFAULT 'weekly';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS report_weekly_day INTEGER;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS report_monthly_day INTEGER;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS report_delivery_time TIME NOT NULL DEFAULT '09:00:00';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS enable_notifications BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS enable_email BOOLEAN NOT NULL DEFAULT false;

-- ===== PRS TABLE =====
-- Add missing columns to prs
ALTER TABLE public.prs 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.prs 
ADD COLUMN IF NOT EXISTS workout_id UUID;

ALTER TABLE public.prs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

COMMIT;

-- =================================================================
-- VERIFICATION QUERY
-- =================================================================
SELECT 
  table_name,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'prs')
ORDER BY table_name, ordinal_position;
