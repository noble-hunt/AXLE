# Production Schema Sync Analysis

## Current Production Schema (Public)
From your Supabase dump, production has:

### profiles table:
- user_id, username, avatar_url, created_at, first_name, last_name, date_of_birth
- updated_at, last_lat, last_lon, timezone, preferred_unit, favorite_movements

### prs table:
- id, user_id, category, movement, rep_max, weight_kg, date, value, unit

### workouts table:
- id, user_id, created_at, request, title, notes, sets, completed, feedback
- planned_intensity, perceived_intensity, started_at, seed, gen_seed
- generator_version, generation_id, rationale, critic_score, critic_issues
- raw_workout_json, user_score

### groups, group_members, group_posts, group_reactions, achievements, health_reports, wearable_connections, workout_feedback
- All exist with standard columns

## What Code Expects (shared/schema.ts)
Checking now...
