-- AXLE Complete Production Schema Migration
-- Adds ALL missing columns to align production with shared/schema.ts
-- Safe to run multiple times (uses IF NOT EXISTS)

BEGIN;

-- ============================================
-- WORKOUTS TABLE - Add all missing columns
-- ============================================

-- Already added, but included for completeness
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

-- Legacy seed column
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS seed TEXT;

-- Deterministic generation fields
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS gen_seed JSONB DEFAULT '{}';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS generator_version TEXT DEFAULT 'v0.3.0';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS generation_id TEXT;

-- AI-generated workout fields
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS rationale TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS critic_score INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS critic_issues TEXT[];
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS raw_workout_json JSONB;

-- User score tracking
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_score JSONB;

-- ============================================
-- GROUPS TABLE - Add missing columns
-- ============================================

-- Already added, but included for completeness
ALTER TABLE groups ADD COLUMN IF NOT EXISTS description TEXT;

-- Group photo URL
ALTER TABLE groups ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify workouts columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workouts' 
  AND column_name IN (
    'started_at', 'seed', 'gen_seed', 'generator_version', 
    'generation_id', 'rationale', 'critic_score', 'critic_issues',
    'raw_workout_json', 'user_score'
  )
ORDER BY column_name;

-- Verify groups columns  
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'groups'
  AND column_name IN ('description', 'photo_url')
ORDER BY column_name;
