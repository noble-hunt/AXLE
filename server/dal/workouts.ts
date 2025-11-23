import { db } from '../db.js';
import { workouts, workoutFeedback } from '../../shared/schema.js';
import { eq, and, desc, gte, isNull, isNotNull } from 'drizzle-orm';

/**
 * Maps workout data to frontend format
 * Note: Drizzle already returns camelCase fields, so this is mostly a passthrough
 * with optional computed fields
 */
export function mapWorkoutToFrontend(workout: any) {
  if (!workout) return null;
  
  return {
    id: workout.id,
    userId: workout.userId,
    title: workout.title,
    request: workout.request,
    sets: workout.sets,
    notes: workout.notes,
    completed: workout.completed,
    feedback: workout.feedback,
    startedAt: workout.startedAt,
    createdAt: workout.createdAt,
    generationId: workout.generationId,
    genSeed: workout.genSeed,
    rawWorkoutJson: workout.rawWorkoutJson,
    generatorVersion: workout.generatorVersion
  };
}

export interface InsertWorkoutParams {
  userId: string;
  workout: {
    title: string;
    request: Record<string, any>;
    sets: Record<string, any>;
    notes?: string;
    completed?: boolean;
    feedback?: Record<string, any>;
  };
}

export interface ListWorkoutsOptions {
  limit?: number;
}

export interface UpdateWorkoutPatch {
  title?: string;
  notes?: string;
  sets?: Record<string, any>;
  completed?: boolean;
  feedback?: Record<string, any>;
  startedAt?: string; // ISO timestamp when workout was started
}

export async function insertWorkout({ userId, workout }: InsertWorkoutParams) {
  const [data] = await db.insert(workouts).values({
    userId,
    title: workout.title,
    request: workout.request,
    sets: workout.sets,
    notes: workout.notes,
    completed: workout.completed || false,
    feedback: workout.feedback
  } as any).returning();

  if (!data) {
    throw new Error('Failed to insert workout');
  }

  return mapWorkoutToFrontend(data);
}

export async function listWorkouts(userId: string, options: ListWorkoutsOptions = {}) {
  const { limit = 50 } = options;

  const data = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.createdAt))
    .limit(limit);

  return (data || []).map(mapWorkoutToFrontend);
}

export async function getWorkout(userId: string, id: string) {
  const data = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.id, id)))
    .limit(1);

  if (!data || data.length === 0) {
    return null; // Not found
  }

  return mapWorkoutToFrontend(data[0]);
}

export async function updateWorkout(userId: string, id: string, patch: UpdateWorkoutPatch) {
  const data = await db
    .update(workouts)
    .set(patch as any)
    .where(and(eq(workouts.userId, userId), eq(workouts.id, id)))
    .returning();

  if (!data || data.length === 0) {
    return null; // Not found
  }

  return mapWorkoutToFrontend(data[0]);
}

export async function deleteWorkout(userId: string, id: string) {
  await db
    .delete(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.id, id)));

  return { success: true };
}

/**
 * Atomically start a workout by setting started_at only if it's currently null
 * This prevents race conditions when multiple requests try to start the same workout
 * @param userId - User ID that owns the workout
 * @param id - Workout ID to start
 * @returns Object with workout data and whether it was actually started (vs already started)
 */
export async function startWorkoutAtomic(userId: string, id: string): Promise<{
  workout: any;
  wasAlreadyStarted: boolean;
} | null> {
  const startedAt = new Date();
  
  // Atomic conditional update: only update if started_at is null
  const data = await db
    .update(workouts)
    .set({ 
      startedAt,
      completed: false
    } as any)
    .where(and(
      eq(workouts.userId, userId),
      eq(workouts.id, id),
      isNull(workouts.startedAt) // Only update if startedAt is currently null
    ))
    .returning();

  if (!data || data.length === 0) {
    // No rows were updated - either workout doesn't exist or already started
    // Check if workout exists
    const existing = await getWorkout(userId, id);
    if (!existing) {
      return null; // Workout doesn't exist
    }
    // Workout exists but already started
    return {
      workout: existing,
      wasAlreadyStarted: true
    };
  }

  // Successfully started
  return {
    workout: mapWorkoutToFrontend(data[0]),
    wasAlreadyStarted: false
  };
}

/**
 * Get average RPE (perceived intensity) from recent completed workouts
 * @param userId - User ID to query workouts for
 * @param hours - Number of hours to look back (default: 24)
 * @returns Average difficulty score from feedback, or null if no completed workouts found
 */
export async function getRecentRPE(userId: string, hours: number = 24): Promise<number | null> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);

  const data = await db
    .select({ feedback: workouts.feedback })
    .from(workouts)
    .where(and(
      eq(workouts.userId, userId),
      eq(workouts.completed, true),
      gte(workouts.createdAt, cutoffDate),
      isNotNull(workouts.feedback)
    ));

  if (!data || data.length === 0) {
    return null;
  }

  // Extract difficulty scores from feedback
  const difficultyScores: number[] = [];
  for (const workout of data) {
    const feedback = workout.feedback as any;
    if (feedback && typeof feedback.difficulty === 'number') {
      difficultyScores.push(feedback.difficulty);
    }
  }

  if (difficultyScores.length === 0) {
    return null;
  }

  // Calculate average
  const sum = difficultyScores.reduce((acc, score) => acc + score, 0);
  return Math.round((sum / difficultyScores.length) * 10) / 10; // Round to 1 decimal place
}

/**
 * Get zone minutes distribution over last 14 days
 * @param userId - User ID to query workouts for
 * @returns Object with minutes per zone, or null if no workouts found
 */
export async function getZoneMinutes14d(userId: string): Promise<Record<string, number> | null> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);

  const data = await db
    .select({ sets: workouts.sets, request: workouts.request })
    .from(workouts)
    .where(and(
      eq(workouts.userId, userId),
      eq(workouts.completed, true),
      gte(workouts.createdAt, cutoffDate)
    ));

  if (!data || data.length === 0) {
    return null;
  }

  // Initialize zone counters
  const zoneMinutes: Record<string, number> = {
    'zone1': 0, // Recovery (50-60% max HR)
    'zone2': 0, // Aerobic Base (60-70% max HR)
    'zone3': 0, // Aerobic (70-80% max HR)
    'zone4': 0, // Lactate Threshold (80-90% max HR)
    'zone5': 0, // Neuromuscular Power (90-100% max HR)
  };

  // Process each workout
  for (const workout of data) {
    const sets = workout.sets as any;
    const request = workout.request as any;
    
    if (!sets || !Array.isArray(sets)) continue;

    // Get workout intensity from request (if available)
    const workoutIntensity = request?.intensity || 5; // Default to moderate intensity

    // Calculate zone based on intensity level
    let zone: string;
    if (workoutIntensity <= 2) zone = 'zone1';
    else if (workoutIntensity <= 4) zone = 'zone2';
    else if (workoutIntensity <= 6) zone = 'zone3';
    else if (workoutIntensity <= 8) zone = 'zone4';
    else zone = 'zone5';

    // Sum up duration from all sets
    let totalMinutes = 0;
    for (const set of sets) {
      if (typeof set.duration === 'number') {
        totalMinutes += set.duration / 60; // Convert seconds to minutes
      }
    }

    // If no set durations, use estimated duration based on set count and rest
    if (totalMinutes === 0 && sets.length > 0) {
      // Estimate ~1 minute per set plus rest time
      totalMinutes = sets.length * 1.5; // 1.5 minutes per set (including rest)
    }

    zoneMinutes[zone] += totalMinutes;
  }

  // Round all values
  Object.keys(zoneMinutes).forEach(zone => {
    zoneMinutes[zone] = Math.round(zoneMinutes[zone]);
  });

  return zoneMinutes;
}

/**
 * Calculate workout strain over a given time period
 * @param userId - User ID to query workouts for
 * @param hours - Number of hours to look back
 * @returns Strain score (0-100), or null if no workouts found
 */
export async function getStrain(userId: string, hours: number): Promise<number | null> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);

  const data = await db
    .select({ 
      sets: workouts.sets, 
      request: workouts.request, 
      feedback: workouts.feedback 
    })
    .from(workouts)
    .where(and(
      eq(workouts.userId, userId),
      eq(workouts.completed, true),
      gte(workouts.createdAt, cutoffDate)
    ));

  if (!data || data.length === 0) {
    return null;
  }

  let totalStrain = 0;

  for (const workout of data) {
    const sets = workout.sets as any;
    const request = workout.request as any;
    const feedback = workout.feedback as any;

    // Get intensity factor from various sources
    let intensityFactor = 1.0;
    
    // Use feedback difficulty if available (1-10 scale)
    if (feedback?.difficulty) {
      intensityFactor = feedback.difficulty / 10;
    }
    // Fallback to request intensity (1-10 scale)
    else if (request?.intensity) {
      intensityFactor = request.intensity / 10;
    }
    
    // Calculate workout duration in minutes
    let durationMinutes = 0;
    
    if (sets && Array.isArray(sets)) {
      // Sum up duration from all sets
      for (const set of sets) {
        if (typeof set.duration === 'number') {
          durationMinutes += set.duration / 60; // Convert seconds to minutes
        }
      }
      
      // If no set durations, estimate based on set count
      if (durationMinutes === 0) {
        durationMinutes = sets.length * 1.5; // ~1.5 minutes per set
      }
    }
    
    // Fallback to request duration if available
    if (durationMinutes === 0 && request?.duration) {
      durationMinutes = request.duration;
    }

    // Calculate strain for this workout: duration * intensity factor
    const workoutStrain = durationMinutes * intensityFactor;
    totalStrain += workoutStrain;
  }

  // Scale to 0-100 range
  // Using a logarithmic scale where 60 minutes at max intensity = 100 strain
  const maxStrain = 60 * 1.0; // 60 minutes at full intensity
  const scaledStrain = Math.min(100, (totalStrain / maxStrain) * 100);
  
  return Math.round(scaledStrain);
}

/**
 * Get user's recent workouts for a specified number of days
 * @param userId - User ID to query workouts for
 * @param options - Options including number of days to look back
 * @returns Array of recent workouts
 */
/**
 * Insert workout feedback into the workout_feedback table
 */
export interface InsertWorkoutFeedbackParams {
  workoutId: string;
  userId: string;
  perceivedIntensity: number;
  notes?: string;
}

export async function insertWorkoutFeedback({ workoutId, userId, perceivedIntensity, notes }: InsertWorkoutFeedbackParams) {
  try {
    const [data] = await db.insert(workoutFeedback).values({
      workoutId,
      userId,
      perceivedIntensity,
      notes: notes || null
    } as any).returning();

    return data;
  } catch (error: any) {
    // Improve error handling for duplicates
    if (error.code === '23505') { // PostgreSQL unique violation
      throw new Error('Feedback already submitted for this workout');
    }
    throw new Error(`Failed to insert workout feedback: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get recent RPE values for a user to inform progression decisions
 */
export async function getRecentRPEs(userId: string, limit: number = 10) {
  const data = await db
    .select({
      workoutId: workoutFeedback.workoutId,
      perceivedIntensity: workoutFeedback.perceivedIntensity,
      createdAt: workoutFeedback.createdAt
    })
    .from(workoutFeedback)
    .where(eq(workoutFeedback.userId, userId))
    .orderBy(desc(workoutFeedback.createdAt))
    .limit(limit);

  return data || [];
}

export async function getUserRecentWorkouts(userId: string, options: { days: number }) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.days);

  const data = await db
    .select()
    .from(workouts)
    .where(and(
      eq(workouts.userId, userId),
      eq(workouts.completed, true),
      gte(workouts.createdAt, cutoffDate)
    ))
    .orderBy(desc(workouts.createdAt));

  // Transform the data to include the fields needed by the score engine
  return (data || []).map(workout => ({
    ...workout,
    total_active_minutes: workout.sets && Array.isArray(workout.sets) 
      ? workout.sets.reduce((total: number, set: any) => {
          return total + (set.duration ? set.duration / 60 : 1.5); // Convert seconds to minutes or estimate
        }, 0)
      : 0,
    intensity: (workout.request as any)?.intensity ?? 5,
    energy_system: (workout.request as any)?.energy_system ?? 'aerobic'
  }));
}