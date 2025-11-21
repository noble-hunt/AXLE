-- AXLE Production Schema Hardening Migration
-- Generated: 2025-11-21
-- Purpose: Add ALL missing columns from shared/schema.ts to production Supabase
-- Safe to run multiple times (uses IF NOT EXISTS)

BEGIN;

-- ============================================
-- WORKOUTS TABLE
-- ============================================
-- All deterministic generation and AI fields
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS seed TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS gen_seed JSONB DEFAULT '{}' NOT NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS generator_version TEXT DEFAULT 'v0.3.0' NOT NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS generation_id TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS rationale TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS critic_score INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS critic_issues TEXT[];
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS raw_workout_json JSONB;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_score JSONB;

-- ============================================
-- GROUPS TABLE
-- ============================================
ALTER TABLE groups ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false NOT NULL;

-- ============================================
-- HEALTH_REPORTS TABLE
-- ============================================
ALTER TABLE health_reports ADD COLUMN IF NOT EXISTS fatigue_score REAL;

COMMIT;

-- ============================================
-- VERIFICATION - Run these to confirm all columns exist
-- ============================================

-- Verify workouts columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'workouts' 
  AND column_name IN (
    'started_at', 'seed', 'gen_seed', 'generator_version', 
    'generation_id', 'rationale', 'critic_score', 'critic_issues',
    'raw_workout_json', 'user_score'
  )
ORDER BY column_name;

-- Verify groups columns  
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'groups'
  AND column_name IN ('description', 'photo_url', 'is_public')
ORDER BY column_name;

-- Verify health_reports columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'health_reports'
  AND column_name = 'fatigue_score';
