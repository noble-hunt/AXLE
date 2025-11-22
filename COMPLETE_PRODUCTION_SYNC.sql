-- =================================================================
-- COMPREHENSIVE PRODUCTION SCHEMA SYNC
-- =================================================================
-- Generated: 2025-11-22
-- Purpose: Add ALL missing columns and tables to match code expectations
-- This is a ONE-TIME comprehensive sync - run this once and you're done!
-- =================================================================

BEGIN;

-- =================================================================
-- STEP 1: Create Required Enums
-- =================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_frequency') THEN
    CREATE TYPE report_frequency AS ENUM ('none', 'weekly', 'monthly', 'both');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_cadence') THEN
    CREATE TYPE report_cadence AS ENUM ('weekly', 'monthly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('generating', 'ready', 'delivered', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_kind') THEN
    CREATE TYPE post_kind AS ENUM ('text', 'workout', 'pr', 'event');
  END IF;
END $$;

-- =================================================================
-- STEP 2: Update PROFILES Table
-- =================================================================

-- Add missing columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS providers TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS latitude REAL,
ADD COLUMN IF NOT EXISTS longitude REAL,
ADD COLUMN IF NOT EXISTS report_frequency report_frequency NOT NULL DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS report_weekly_day INTEGER,
ADD COLUMN IF NOT EXISTS report_monthly_day INTEGER,
ADD COLUMN IF NOT EXISTS report_delivery_time TIME NOT NULL DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS enable_notifications BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_email BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Migrate old location columns if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_lat') THEN
    UPDATE public.profiles SET latitude = last_lat::real WHERE last_lat IS NOT NULL;
    ALTER TABLE public.profiles DROP COLUMN last_lat;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_lon') THEN
    UPDATE public.profiles SET longitude = last_lon::real WHERE last_lon IS NOT NULL;
    ALTER TABLE public.profiles DROP COLUMN last_lon;
  END IF;
END $$;

-- =================================================================
-- STEP 3: Update PRS Table
-- =================================================================

ALTER TABLE public.prs 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS workout_id UUID,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- =================================================================
-- STEP 4: Create AXLE_REPORTS Table (if missing)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.axle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  frequency report_cadence NOT NULL,
  timeframe_start TIMESTAMP WITH TIME ZONE NOT NULL,
  timeframe_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status report_status NOT NULL DEFAULT 'generating',
  generator_version TEXT NOT NULL DEFAULT 'v1.0.0',
  metrics JSONB NOT NULL,
  insights JSONB NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_channel TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT timeframe_order_check CHECK (timeframe_end > timeframe_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS axle_reports_user_period_unique 
ON public.axle_reports (user_id, frequency, timeframe_start);

CREATE INDEX IF NOT EXISTS axle_reports_user_timeframe_idx 
ON public.axle_reports (user_id, timeframe_start);

-- =================================================================
-- STEP 5: Create POSTS Table (if missing)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  kind post_kind NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- STEP 6: Migrate GROUP_POSTS Structure
-- =================================================================
-- Production has: id, group_id, author_id, body, meta, created_at
-- Code expects: group_id, post_id, created_at (junction table)
-- Rename old table and create new structure

DO $$
BEGIN
  -- Check if old structure exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'group_posts' 
    AND column_name = 'author_id'
  ) THEN
    -- Rename old table to preserve data
    ALTER TABLE public.group_posts RENAME TO group_posts_legacy;
    
    -- Create new junction table structure
    CREATE TABLE public.group_posts (
      group_id UUID NOT NULL REFERENCES public.groups(id),
      post_id UUID NOT NULL REFERENCES public.posts(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (group_id, post_id)
    );
  END IF;
END $$;

-- =================================================================
-- STEP 7: Create GROUP_MESSAGES Table (if missing)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- STEP 8: Update GROUP_REACTIONS Structure
-- =================================================================
-- Production has: post_id (bigint), user_id, emoji, created_at
-- Code expects: group_id, post_id (uuid), user_id, emoji, created_at

DO $$
BEGIN
  -- Check if old structure exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'group_reactions' 
    AND column_name = 'post_id'
    AND data_type = 'bigint'
  ) THEN
    -- Rename old table to preserve data
    ALTER TABLE public.group_reactions RENAME TO group_reactions_legacy;
    
    -- Create new structure
    CREATE TABLE public.group_reactions (
      group_id UUID NOT NULL REFERENCES public.groups(id),
      post_id UUID NOT NULL REFERENCES public.posts(id),
      user_id UUID NOT NULL REFERENCES auth.users(id),
      emoji TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (group_id, post_id, user_id, emoji)
    );
  END IF;
END $$;

-- =================================================================
-- STEP 9: Create GROUP_EVENT_RSVPS Table (if missing)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.group_event_rsvps (
  group_id UUID NOT NULL REFERENCES public.groups(id),
  post_id UUID NOT NULL REFERENCES public.posts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, post_id, user_id)
);

-- =================================================================
-- STEP 10: Create GROUP_INVITES Table (if missing)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  code TEXT NOT NULL UNIQUE,
  invited_email TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- STEP 11: Create REFERRALS Table (if missing)
-- =================================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID REFERENCES auth.users(id),
  group_id UUID REFERENCES public.groups(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;

-- =================================================================
-- VERIFICATION QUERY
-- =================================================================
-- Run this to see all your tables and column counts:

SELECT 
  schemaname, 
  tablename,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = schemaname AND table_name = tablename) as column_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
