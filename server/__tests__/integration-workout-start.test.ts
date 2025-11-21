import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { startWorkoutAtomic } from '../dal/workouts.js';

// Real integration test - tests actual Supabase integration with atomic operations
describe('Workout Start Integration Tests', () => {
  const TEST_USER_ID = 'test-integration-user-123';

  afterEach(async () => {
    // Clean up test data
    try {
      await supabaseAdmin
        .from('workouts')
        .delete()
        .eq('user_id', TEST_USER_ID);
      
      // Also clean up other test users
      await supabaseAdmin
        .from('workouts')
        .delete()
        .eq('user_id', 'different-user-456');
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Atomic Workout Start with Real Supabase', () => {
    it('should start a workout atomically via real DAL function', async () => {
      // Create a test workout first
      const { data: workout, error: createError } = await supabaseAdmin
        .from('workouts')
        .insert({
          user_id: TEST_USER_ID,
          title: 'Integration Test Workout',
          request: { duration: 30, intensity: 5 },
          sets: [],
          completed: false,
          started_at: null
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(workout).toBeTruthy();
      expect(workout.started_at).toBeNull();

      // Start the workout via the atomic DAL function
      const result = await startWorkoutAtomic(TEST_USER_ID, workout.id);

      // Verify result structure
      expect(result).toBeTruthy();
      expect(result!.workout.id).toBe(workout.id);
      expect(result!.wasAlreadyStarted).toBe(false);
      expect(result!.workout.started_at).toBeTruthy();

      // Verify the workout was actually updated in Supabase
      const { data: updatedWorkout, error: fetchError } = await supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('id', workout.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updatedWorkout.started_at).toBeTruthy();
      expect(new Date(updatedWorkout.started_at).getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should handle idempotent calls correctly with real Supabase', async () => {
      // Create a workout that's already started
      const startedAt = new Date().toISOString();
      const { data: workout, error: createError } = await supabaseAdmin
        .from('workouts')
        .insert({
          user_id: TEST_USER_ID,
          title: 'Already Started Workout',
          request: { duration: 45, intensity: 7 },
          sets: [],
          completed: false,
          started_at: startedAt
        })
        .select()
        .single();

      expect(createError).toBeNull();

      // Try to start the already started workout
      const result = await startWorkoutAtomic(TEST_USER_ID, workout.id);

      // Should return idempotent response
      expect(result).toBeTruthy();
      expect(result!.workout.id).toBe(workout.id);
      expect(result!.wasAlreadyStarted).toBe(true);
      expect(result!.workout.started_at).toBe(startedAt);

      // Verify the original started_at timestamp wasn't changed
      const { data: unchangedWorkout, error: fetchError } = await supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('id', workout.id)
        .single();

      expect(fetchError).toBeNull();
      expect(unchangedWorkout.started_at).toBe(startedAt);
    });

    it('should handle concurrent start requests atomically with real Supabase', async () => {
      // Create a test workout
      const { data: workout, error: createError } = await supabaseAdmin
        .from('workouts')
        .insert({
          user_id: TEST_USER_ID,
          title: 'Concurrency Test Workout',
          request: { duration: 30, intensity: 6 },
          sets: [],
          completed: false,
          started_at: null
        })
        .select()
        .single();

      expect(createError).toBeNull();

      // Simulate concurrent start requests
      const [result1, result2] = await Promise.all([
        startWorkoutAtomic(TEST_USER_ID, workout.id),
        startWorkoutAtomic(TEST_USER_ID, workout.id)
      ]);

      // Both should succeed (one starts, one is idempotent)
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();

      // Both should have the same workout ID
      expect(result1!.workout.id).toBe(workout.id);
      expect(result2!.workout.id).toBe(workout.id);

      // Exactly one should have started it, one should be idempotent
      const startedCount = [result1, result2].filter(r => !r!.wasAlreadyStarted).length;
      const idempotentCount = [result1, result2].filter(r => r!.wasAlreadyStarted).length;
      
      expect(startedCount).toBe(1);
      expect(idempotentCount).toBe(1);

      // Verify final state in database
      const { data: finalWorkout, error: fetchError } = await supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('id', workout.id)
        .single();

      expect(fetchError).toBeNull();
      expect(finalWorkout.started_at).toBeTruthy();
    });

    it('should return null for non-existent workout', async () => {
      const result = await startWorkoutAtomic(TEST_USER_ID, 'nonexistent-workout-id');
      expect(result).toBeNull();
    });

    it('should enforce user scoping with real Supabase', async () => {
      // Create workout for different user
      const { data: otherUserWorkout, error: createError } = await supabaseAdmin
        .from('workouts')
        .insert({
          user_id: 'different-user-456',
          title: 'Other User Workout',
          request: { duration: 30, intensity: 5 },
          sets: [],
          completed: false,
          started_at: null
        })
        .select()
        .single();

      expect(createError).toBeNull();

      // Try to start workout belonging to different user
      const result = await startWorkoutAtomic(TEST_USER_ID, otherUserWorkout.id);

      // Should return null (not found for this user)
      expect(result).toBeNull();

      // Verify the other user's workout wasn't modified
      const { data: unchangedWorkout, error: fetchError } = await supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('id', otherUserWorkout.id)
        .single();

      expect(fetchError).toBeNull();
      expect(unchangedWorkout.started_at).toBeNull();
    });
  });

  describe('Schema Guard Integration', () => {
    it('should validate that started_at column exists and is writable', async () => {
      // This test validates the schema guard is working by testing real DB operations
      
      // Test that we can create workout with started_at
      const { data: workout, error: createError } = await supabaseAdmin
        .from('workouts')
        .insert({
          user_id: 'test-integration-user-123',
          title: 'Schema Test Workout',
          request: { test: true },
          sets: [],
          completed: false,
          started_at: new Date().toISOString() // Test that started_at accepts timestamps
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(workout).toBeTruthy();
      expect(workout.started_at).toBeTruthy();

      // Test that we can query started_at
      const { data: queriedWorkout, error: queryError } = await supabaseAdmin
        .from('workouts')
        .select('id, started_at')
        .eq('id', workout.id)
        .single();

      expect(queryError).toBeNull();
      expect(queriedWorkout.started_at).toBeTruthy();

      // Test that we can update started_at
      const newTimestamp = new Date().toISOString();
      const { data: updatedWorkout, error: updateError } = await supabaseAdmin
        .from('workouts')
        .update({ started_at: newTimestamp })
        .eq('id', workout.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updatedWorkout.started_at).toBe(newTimestamp);
    });
  });
});