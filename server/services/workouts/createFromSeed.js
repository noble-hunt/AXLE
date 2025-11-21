import { v4 as uuid } from 'uuid';
import * as Sentry from '@sentry/node';
import { generateWithFallback } from '../../lib/generator/generate.js';
import { db } from '../../db.js';
import { workouts } from '../../../shared/schema.js';
export async function createWorkoutFromSeed(args) {
    try {
        // Convert suggestion data to generator inputs format
        const inputs = {
            archetype: mapFocusToArchetype(args.focus),
            minutes: args.minutes,
            targetIntensity: args.intensity,
            equipment: [], // Default to bodyweight, can be enhanced later
            constraints: []
        };
        // Generate workout using the fallback system
        const result = await generateWithFallback(inputs, {
            context: {
                dateISO: new Date().toISOString(),
                userId: args.userId
            },
            seed: args.seed.rngSeed || uuid(),
            source: args.source
        });
        const workout = result.workout || result;
        const id = uuid();
        // Create workout record in database
        const [savedWorkout] = await db.insert(workouts).values({
            id,
            userId: args.userId,
            title: workout.name || `${args.focus} Workout`,
            request: {
                focus: args.focus,
                minutes: args.minutes,
                intensity: args.intensity,
                source: args.source,
                generatedAt: new Date().toISOString()
            },
            sets: workout.blocks?.map((block, index) => ({
                id: `block-${index}`,
                exercise: block.name || block.type || 'Exercise',
                notes: block.notes || block.description || ''
            })) || [],
            notes: workout.coaching_notes || workout.description || '',
            completed: false,
            genSeed: args.seed,
            generatorVersion: args.generatorVersion,
            generationId: (args.seed.rngSeed || uuid())
        }).returning();
        return { id: savedWorkout.id };
    }
    catch (e) {
        Sentry.captureException(e, { tags: { svc: 'createWorkoutFromSeed' } });
        throw e;
    }
}
// Helper function to map focus strings to generator archetypes
function mapFocusToArchetype(focus) {
    const focusLower = focus.toLowerCase();
    if (focusLower.includes('strength') || focusLower.includes('power')) {
        return 'strength';
    }
    if (focusLower.includes('cardio') || focusLower.includes('endurance') || focusLower.includes('aerobic')) {
        return 'endurance';
    }
    if (focusLower.includes('conditioning') || focusLower.includes('hiit') || focusLower.includes('metcon')) {
        return 'conditioning';
    }
    // Default to mixed for general fitness, recovery, etc.
    return 'mixed';
}
