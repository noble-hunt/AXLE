-- Add Missing Columns to Auth Schema
-- Generated: 2025-11-21
-- Purpose: Add favorite_movements and unit columns that code expects but database is missing

BEGIN;

-- =================================================================
-- PROFILES TABLE - Add favorite_movements
-- =================================================================
ALTER TABLE auth.profiles 
ADD COLUMN IF NOT EXISTS favorite_movements TEXT[] NOT NULL DEFAULT '{}';

-- =================================================================
-- PRS TABLE - Add unit column
-- =================================================================
ALTER TABLE auth.prs 
ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'lbs';

COMMIT;

-- Verification: Check that columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name IN ('profiles', 'prs')
  AND column_name IN ('favorite_movements', 'unit')
ORDER BY table_name, column_name;
