import { supabaseAdmin } from "../lib/supabaseAdmin.js";
/**
 * Maps workout data from database snake_case to frontend camelCase
 */
export function mapWorkoutToFrontend(workout) {
    if (!workout)
        return null;
    return {
        id: workout.id,
        userId: workout.user_id,
        title: workout.title,
        request: workout.request,
        sets: workout.sets,
        notes: workout.notes,
        completed: workout.completed,
        feedback: workout.feedback,
        startedAt: workout.started_at,
        createdAt: workout.created_at,
        totalActiveMinutes: workout.total_active_minutes,
        intensity: workout.intensity,
        energySystem: workout.energy_system,
        generationId: workout.generation_id
    };
}
export async function insertWorkout({ userId, workout }) {
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .insert({
        user_id: userId,
        title: workout.title,
        request: workout.request,
        sets: workout.sets,
        notes: workout.notes,
        completed: workout.completed || false,
        feedback: workout.feedback
    })
        .select()
        .single();
    if (error) {
        throw new Error(`Failed to insert workout: ${error.message}`);
    }
    return mapWorkoutToFrontend(data);
}
export async function listWorkouts(userId, options = {}) {
    const { limit = 50 } = options;
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        throw new Error(`Failed to list workouts: ${error.message}`);
    }
    return (data || []).map(mapWorkoutToFrontend);
}
export async function getWorkout(userId, id) {
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        throw new Error(`Failed to get workout: ${error.message}`);
    }
    return mapWorkoutToFrontend(data);
}
export async function updateWorkout(userId, id, patch) {
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .update(patch)
        .eq('user_id', userId)
        .eq('id', id)
        .select()
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        throw new Error(`Failed to update workout: ${error.message}`);
    }
    return mapWorkoutToFrontend(data);
}
export async function deleteWorkout(userId, id) {
    const { error } = await supabaseAdmin
        .from('workouts')
        .delete()
        .eq('user_id', userId)
        .eq('id', id);
    if (error) {
        throw new Error(`Failed to delete workout: ${error.message}`);
    }
    return { success: true };
}
/**
 * Atomically start a workout by setting started_at only if it's currently null
 * This prevents race conditions when multiple requests try to start the same workout
 * @param userId - User ID that owns the workout
 * @param id - Workout ID to start
 * @returns Object with workout data and whether it was actually started (vs already started)
 */
export async function startWorkoutAtomic(userId, id) {
    const startedAt = new Date().toISOString();
    // Atomic conditional update: only update if started_at is null
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .update({
        started_at: startedAt,
        completed: false
    })
        .eq('user_id', userId)
        .eq('id', id)
        .is('started_at', null) // Only update if started_at is currently null
        .select()
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
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
        throw new Error(`Failed to start workout: ${error.message}`);
    }
    // Successfully started
    return {
        workout: mapWorkoutToFrontend(data),
        wasAlreadyStarted: false
    };
}
/**
 * Get average RPE (perceived intensity) from recent completed workouts
 * @param userId - User ID to query workouts for
 * @param hours - Number of hours to look back (default: 24)
 * @returns Average difficulty score from feedback, or null if no completed workouts found
 */
export async function getRecentRPE(userId, hours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .select('feedback')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('created_at', cutoffDate.toISOString())
        .not('feedback', 'is', null);
    if (error) {
        throw new Error(`Failed to get recent RPE: ${error.message}`);
    }
    if (!data || data.length === 0) {
        return null;
    }
    // Extract difficulty scores from feedback
    const difficultyScores = [];
    for (const workout of data) {
        const feedback = workout.feedback;
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
export async function getZoneMinutes14d(userId) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .select('sets, request')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('created_at', cutoffDate.toISOString());
    if (error) {
        throw new Error(`Failed to get zone minutes: ${error.message}`);
    }
    if (!data || data.length === 0) {
        return null;
    }
    // Initialize zone counters
    const zoneMinutes = {
        'zone1': 0, // Recovery (50-60% max HR)
        'zone2': 0, // Aerobic Base (60-70% max HR)
        'zone3': 0, // Aerobic (70-80% max HR)
        'zone4': 0, // Lactate Threshold (80-90% max HR)
        'zone5': 0, // Neuromuscular Power (90-100% max HR)
    };
    // Process each workout
    for (const workout of data) {
        const sets = workout.sets;
        const request = workout.request;
        if (!sets || !Array.isArray(sets))
            continue;
        // Get workout intensity from request (if available)
        const workoutIntensity = request?.intensity || 5; // Default to moderate intensity
        // Calculate zone based on intensity level
        let zone;
        if (workoutIntensity <= 2)
            zone = 'zone1';
        else if (workoutIntensity <= 4)
            zone = 'zone2';
        else if (workoutIntensity <= 6)
            zone = 'zone3';
        else if (workoutIntensity <= 8)
            zone = 'zone4';
        else
            zone = 'zone5';
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
export async function getStrain(userId, hours) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .select('sets, request, feedback')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('created_at', cutoffDate.toISOString());
    if (error) {
        throw new Error(`Failed to get strain: ${error.message}`);
    }
    if (!data || data.length === 0) {
        return null;
    }
    let totalStrain = 0;
    for (const workout of data) {
        const sets = workout.sets;
        const request = workout.request;
        const feedback = workout.feedback;
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
export async function insertWorkoutFeedback({ workoutId, userId, perceivedIntensity, notes }) {
    const { data, error } = await supabaseAdmin
        .from('workout_feedback')
        .insert({
        workout_id: workoutId,
        user_id: userId,
        perceived_intensity: perceivedIntensity,
        notes: notes || null
    })
        .select()
        .single();
    if (error) {
        // Improve error handling for duplicates
        if (error.code === '23505') { // PostgreSQL unique violation
            throw new Error('Feedback already submitted for this workout');
        }
        throw new Error(`Failed to insert workout feedback: ${error.message}`);
    }
    return data;
}
/**
 * Get recent RPE values for a user to inform progression decisions
 */
export async function getRecentRPEs(userId, limit = 10) {
    const { data, error } = await supabaseAdmin
        .from('workout_feedback')
        .select('workout_id, perceived_intensity, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        throw new Error(`Failed to get recent RPEs: ${error.message}`);
    }
    return data || [];
}
export async function getUserRecentWorkouts(userId, options) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.days);
    const { data, error } = await supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });
    if (error) {
        throw new Error(`Failed to get recent workouts: ${error.message}`);
    }
    // Transform the data to include the fields needed by the score engine
    return (data || []).map(workout => ({
        ...workout,
        total_active_minutes: workout.sets && Array.isArray(workout.sets)
            ? workout.sets.reduce((total, set) => {
                return total + (set.duration ? set.duration / 60 : 1.5); // Convert seconds to minutes or estimate
            }, 0)
            : 0,
        intensity: workout.request?.intensity ?? 5,
        energy_system: workout.request?.energy_system ?? 'aerobic'
    }));
}
