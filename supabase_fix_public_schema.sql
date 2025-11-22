-- =================================================================
-- CRITICAL FIX: Add Missing Columns to PUBLIC Schema
-- =================================================================
-- Generated: 2025-11-21
-- Purpose: Add columns that code expects but are missing from database
-- Schema: PUBLIC (not auth - that's where the tables actually are)
-- =================================================================

BEGIN;

-- Add favorite_movements to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS favorite_movements TEXT[] NOT NULL DEFAULT '{}';

-- Add unit to prs table  
ALTER TABLE public.prs 
ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'lbs';

COMMIT;

-- =================================================================
-- VERIFICATION QUERY
-- =================================================================
-- Run this to confirm columns were added successfully:

SELECT 
  table_name,
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'prs')
  AND column_name IN ('favorite_movements', 'unit')
ORDER BY table_name, column_name;
