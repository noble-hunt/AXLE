import { v4 as uuid } from 'uuid';
import * as Sentry from '@sentry/node';
import { generateWithFallback } from '../../lib/generator/generate.js';
import { db } from '../../db.js';
import { workouts } from '../../../shared/schema.js';

type Args = {
  userId: string;
  focus: string;
  minutes: number;
  intensity: number;
  seed: Record<string, any>;
  generatorVersion: string;
  source: string;
};

export async function createWorkoutFromSeed(args: Args) {
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
      title: (workout as any).name || `${args.focus} Workout`,
      request: {
        focus: args.focus,
        minutes: args.minutes,
        intensity: args.intensity as any,
        source: args.source,
        generatedAt: new Date().toISOString()
      } as any,
      sets: (workout as any).blocks?.map((block: any, index: number) => ({
        id: `block-${index}`,
        exercise: block.name || block.type || 'Exercise',
        notes: block.notes || block.description || ''
      })) as any || [],
      notes: (workout as any).coaching_notes || (workout as any).description || '',
      completed: false,
      genSeed: args.seed as any,
      generatorVersion: args.generatorVersion,
      generationId: (args.seed.rngSeed || uuid()) as any
    } as any).returning();

    return { id: savedWorkout.id };
  } catch (e) {
    Sentry.captureException(e, { tags: { svc: 'createWorkoutFromSeed' } });
    throw e;
  }
}

// Helper function to map focus strings to generator archetypes
function mapFocusToArchetype(focus: string): 'strength' | 'conditioning' | 'mixed' | 'endurance' {
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