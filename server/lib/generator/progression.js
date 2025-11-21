/**
 * Progressive Overload and Workout History Analysis
 *
 * Analyzes user's recent workouts to apply intelligent progression
 * based on performance and recovery patterns.
 */
/**
 * Enrich workout history with RPE data from workout_feedback table
 */
export async function enrichWorkoutHistoryWithRPE(userId, workouts) {
    try {
        const { getRecentRPEs } = await import('../../dal/workouts.js');
        const rpeData = await getRecentRPEs(userId, 20); // Get more than we need
        // Create lookup map for RPE by workout ID
        const rpeMap = new Map();
        rpeData.forEach(rpe => {
            rpeMap.set(rpe.workout_id, rpe.perceived_intensity);
        });
        // Enrich workouts with RPE data
        return workouts.map(workout => ({
            ...workout,
            rpe: rpeMap.get(workout.id) || workout.rpe
        }));
    }
    catch (error) {
        console.warn('Failed to enrich workout history with RPE data:', error);
        return workouts; // Return original workouts if enrichment fails
    }
}
/**
 * Analyze recent workout history for progression patterns
 */
export function analyzeWorkoutHistory(workouts, targetArchetype) {
    // Sort by date, most recent first
    const sortedWorkouts = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime());
    // Get recent workouts (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const recentWorkouts = sortedWorkouts.filter(w => w.date >= fourWeeksAgo);
    // Find days since last same archetype
    const lastSameArchetype = recentWorkouts.find(w => w.archetype === targetArchetype);
    const daysSinceLastSameArchetype = lastSameArchetype
        ? Math.floor((Date.now() - lastSameArchetype.date.getTime()) / (1000 * 60 * 60 * 24))
        : 14; // Default if no recent history
    // Count consecutive high intensity sessions
    let consecutiveHighIntensity = 0;
    for (const workout of recentWorkouts) {
        if ((workout.actualIntensity || workout.targetIntensity) >= 7) {
            consecutiveHighIntensity++;
        }
        else {
            break;
        }
    }
    // Calculate average recovery from feedback
    const workoutsWithFeedback = recentWorkouts.filter(w => w.feedback);
    const avgRecoveryScore = workoutsWithFeedback.length > 0
        ? workoutsWithFeedback.reduce((sum, w) => sum + (10 - w.feedback.difficulty), 0) / workoutsWithFeedback.length
        : 7; // Default neutral
    // Determine training phase based on patterns
    const trainingPhase = determineTrainingPhase(recentWorkouts, consecutiveHighIntensity);
    return {
        recentWorkouts,
        daysSinceLastSameArchetype,
        consecutiveHighIntensity,
        avgRecoveryScore,
        trainingPhase
    };
}
/**
 * Determine current training phase based on recent pattern
 */
function determineTrainingPhase(recentWorkouts, consecutiveHighIntensity) {
    if (consecutiveHighIntensity >= 4)
        return 'deload';
    const last2Weeks = recentWorkouts.filter(w => {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        return w.date >= twoWeeksAgo;
    });
    const avgIntensity = last2Weeks.length > 0
        ? last2Weeks.reduce((sum, w) => sum + (w.actualIntensity || w.targetIntensity), 0) / last2Weeks.length
        : 5;
    const avgVolume = last2Weeks.length > 0
        ? last2Weeks.reduce((sum, w) => sum + w.volume, 0) / last2Weeks.length
        : 15;
    if (avgIntensity >= 7.5)
        return 'realization';
    if (avgIntensity >= 6)
        return 'intensification';
    return 'accumulation';
}
/**
 * Generate progression directives for strength training
 */
function generateStrengthProgression(context, targetArchetype) {
    const sameArchetypeWorkouts = context.recentWorkouts
        .filter(w => w.archetype === targetArchetype)
        .slice(0, 4); // Last 4 sessions
    // Check for deload conditions
    if (context.consecutiveHighIntensity >= 4 ||
        context.avgRecoveryScore < 4 ||
        context.trainingPhase === 'deload') {
        return {
            loadAdjustment: 0.8,
            volumeAdjustment: 0.7,
            intensityAdjustment: -2,
            deloadRecommended: true,
            progressionType: 'deload',
            reasoning: 'Deload recommended due to accumulated fatigue'
        };
    }
    // No recent history - start conservative
    if (sameArchetypeWorkouts.length === 0) {
        return {
            loadAdjustment: 0.9,
            volumeAdjustment: 0.9,
            intensityAdjustment: 0,
            deloadRecommended: false,
            progressionType: 'load',
            reasoning: 'Conservative start due to no recent history'
        };
    }
    const lastWorkout = sameArchetypeWorkouts[0];
    const lastRPE = lastWorkout.rpe || lastWorkout.feedback?.difficulty || 5;
    // Progressive overload logic
    if (lastRPE < 7 && context.avgRecoveryScore > 6) {
        // Can handle more load
        return {
            loadAdjustment: 1.05, // 5% load increase
            volumeAdjustment: 1.0,
            intensityAdjustment: 0,
            deloadRecommended: false,
            progressionType: 'load',
            reasoning: 'Increasing load due to low perceived exertion'
        };
    }
    else if (lastRPE >= 9 || context.avgRecoveryScore < 5) {
        // Too challenging - reduce load slightly
        return {
            loadAdjustment: 0.95,
            volumeAdjustment: 1.0,
            intensityAdjustment: -1,
            deloadRecommended: false,
            progressionType: 'deload',
            reasoning: 'Reducing load due to high fatigue indicators'
        };
    }
    else {
        // Maintain with slight volume progression
        return {
            loadAdjustment: 1.0,
            volumeAdjustment: 1.1, // Add one set
            intensityAdjustment: 0,
            deloadRecommended: false,
            progressionType: 'volume',
            reasoning: 'Adding volume while maintaining load'
        };
    }
}
/**
 * Generate progression directives for conditioning training
 */
function generateConditioningProgression(context, targetArchetype) {
    const sameArchetypeWorkouts = context.recentWorkouts
        .filter(w => w.archetype === targetArchetype)
        .slice(0, 4);
    // Deload every 4-5 exposures or if fatigued
    const needsDeload = sameArchetypeWorkouts.length >= 4 ||
        context.consecutiveHighIntensity >= 3 ||
        context.avgRecoveryScore < 5;
    if (needsDeload) {
        return {
            loadAdjustment: 0.9,
            volumeAdjustment: 0.8,
            intensityAdjustment: -1,
            deloadRecommended: true,
            progressionType: 'deload',
            reasoning: 'Deload recommended for conditioning recovery'
        };
    }
    // Volume or density progression every 2-3 exposures
    const exposureCount = Math.min(sameArchetypeWorkouts.length, 3);
    if (exposureCount >= 2 && context.avgRecoveryScore > 6) {
        // Can handle more work
        const progressionChoice = Math.random() > 0.5 ? 'volume' : 'density';
        if (progressionChoice === 'volume') {
            return {
                loadAdjustment: 1.0,
                volumeAdjustment: 1.1, // 10% more volume
                intensityAdjustment: 0,
                deloadRecommended: false,
                progressionType: 'volume',
                reasoning: 'Increasing volume for conditioning adaptation'
            };
        }
        else {
            return {
                loadAdjustment: 1.0,
                volumeAdjustment: 1.0,
                intensityAdjustment: 1,
                deloadRecommended: false,
                progressionType: 'density',
                reasoning: 'Increasing density for conditioning adaptation'
            };
        }
    }
    // Maintain current level
    return {
        loadAdjustment: 1.0,
        volumeAdjustment: 1.0,
        intensityAdjustment: 0,
        deloadRecommended: false,
        progressionType: 'skill',
        reasoning: 'Maintaining current level for adaptation'
    };
}
/**
 * Generate progression directives for endurance training
 */
function generateEnduranceProgression(context) {
    // Endurance typically progresses through volume then intensity
    if (context.avgRecoveryScore > 7) {
        return {
            loadAdjustment: 1.0,
            volumeAdjustment: 1.05, // Small volume increase
            intensityAdjustment: 0,
            deloadRecommended: false,
            progressionType: 'volume',
            reasoning: 'Gradual volume increase for endurance base'
        };
    }
    return {
        loadAdjustment: 1.0,
        volumeAdjustment: 1.0,
        intensityAdjustment: 0,
        deloadRecommended: false,
        progressionType: 'skill',
        reasoning: 'Maintaining endurance base'
    };
}
/**
 * Main function to generate progression directives
 */
export async function generateProgressionDirectives(userId, workoutHistory, targetArchetype) {
    // Enrich workout history with RPE data from feedback table
    const enrichedHistory = await enrichWorkoutHistoryWithRPE(userId, workoutHistory);
    const context = analyzeWorkoutHistory(enrichedHistory, targetArchetype);
    switch (targetArchetype) {
        case 'strength':
            return generateStrengthProgression(context, targetArchetype);
        case 'conditioning':
        case 'mixed':
            return generateConditioningProgression(context, targetArchetype);
        case 'endurance':
            return generateEnduranceProgression(context);
        default:
            return {
                loadAdjustment: 1.0,
                volumeAdjustment: 1.0,
                intensityAdjustment: 0,
                deloadRecommended: false,
                progressionType: 'skill',
                reasoning: 'Unknown archetype - maintaining current level'
            };
    }
}
/**
 * Convert database workout to WorkoutHistory format
 */
export function convertToWorkoutHistory(dbWorkout) {
    return {
        id: dbWorkout.id,
        date: new Date(dbWorkout.createdAt),
        archetype: mapCategoryToArchetype(dbWorkout.category || dbWorkout.request?.category),
        targetIntensity: dbWorkout.request?.intensity || 5,
        actualIntensity: dbWorkout.feedback?.difficulty,
        volume: dbWorkout.sets?.length || 10,
        rpe: dbWorkout.feedback?.difficulty,
        completed: dbWorkout.completed || false,
        feedback: dbWorkout.feedback ? {
            difficulty: dbWorkout.feedback.difficulty,
            satisfaction: dbWorkout.feedback.satisfaction
        } : undefined
    };
}
/**
 * Map legacy category names to workout archetypes
 */
function mapCategoryToArchetype(category) {
    switch (category?.toLowerCase()) {
        case 'strength':
        case 'powerlifting':
        case 'olympic':
            return 'strength';
        case 'crossfit':
        case 'hiit':
        case 'crossfit/hiit':
            return 'mixed';
        case 'cardio':
        case 'endurance':
        case 'running':
        case 'cycling':
            return 'endurance';
        case 'conditioning':
        case 'metabolic':
            return 'conditioning';
        default:
            return 'mixed';
    }
}
/**
 * Check if user needs extended recovery period
 */
export function needsRecoveryWeek(workoutHistory) {
    const last4Weeks = workoutHistory.filter(w => {
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        return w.date >= fourWeeksAgo;
    });
    const highIntensityCount = last4Weeks.filter(w => (w.actualIntensity || w.targetIntensity) >= 7).length;
    const avgDifficulty = last4Weeks.length > 0
        ? last4Weeks.reduce((sum, w) => sum + (w.rpe || 5), 0) / last4Weeks.length
        : 5;
    return highIntensityCount >= 8 || avgDifficulty >= 8;
}
