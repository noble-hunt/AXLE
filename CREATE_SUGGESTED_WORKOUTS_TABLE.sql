-- Migration: Add suggested_workouts table for daily workout suggestions
-- Date: Nov 23, 2025
-- Purpose: Store pre-generated daily workout suggestions for users

-- Create the suggested_workouts table
CREATE TABLE IF NOT EXISTS suggested_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  request JSONB NOT NULL,
  rationale JSONB NOT NULL,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index to ensure one suggestion per user per day
CREATE UNIQUE INDEX IF NOT EXISTS suggested_workouts_user_date_idx 
  ON suggested_workouts(user_id, date);

-- Create index for efficient queries by user
CREATE INDEX IF NOT EXISTS suggested_workouts_user_id_idx 
  ON suggested_workouts(user_id);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS suggested_workouts_date_idx 
  ON suggested_workouts(date);

-- Add comment to table
COMMENT ON TABLE suggested_workouts IS 'Pre-generated daily workout suggestions for users, created by background cron job at 5 AM UTC';

-- Add comments to columns
COMMENT ON COLUMN suggested_workouts.user_id IS 'User this suggestion is for (FK to auth.users)';
COMMENT ON COLUMN suggested_workouts.date IS 'Date of the suggestion (UTC date)';
COMMENT ON COLUMN suggested_workouts.request IS 'Workout request parameters (category, duration, intensity)';
COMMENT ON COLUMN suggested_workouts.rationale IS 'Suggestion rationale with rules applied, scores, and reasoning';
COMMENT ON COLUMN suggested_workouts.workout_id IS 'ID of the pre-generated workout (FK to workouts table)';
