-- AXLE Production Schema Fix
-- This SQL adds missing columns to the production Supabase database
-- Run this in your Supabase SQL Editor

-- Add started_at column to workouts table
ALTER TABLE workouts 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

-- Add description column to groups table  
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workouts' AND column_name = 'started_at';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'groups' AND column_name = 'description';
