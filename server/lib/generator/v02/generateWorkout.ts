/**
 * v0.2 Generator - Legacy AI-based workout generation
 * 
 * This wraps the existing AI generators and workoutGenerator for fallback
 */

import { generateWorkout as legacyGenerateWorkout } from '../../../workoutGenerator.js';
import { Category } from '../../../../shared/schema.js';

// Define types locally since they're not exported from workoutGenerator
type EnhancedWorkoutRequest = {
  category: Category;
  duration: number;
  intensity: number;
  equipment?: string[];
  constraints?: string[];
  recentPRs?: Array<{
    exercise: string;
    weight?: number;
    reps?: number;
    date: string;
    unit?: string;
  }>;
  lastWorkouts?: Array<{
    name: string;
    category: string;
    duration: number;
    intensity: number;
    date: string;
    exercises: string[];
  }>;
  todaysReport?: {
    energy: number;
    stress: number;
    sleep: number;
    soreness: number;
  };
};

export async function generateWorkout(seed: any, opts?: any) {
  // Convert seed to legacy format
  const legacyRequest: EnhancedWorkoutRequest = {
    category: seed.inputs?.archetype || 'Strength',
    duration: seed.inputs?.minutes || 30,
    intensity: seed.inputs?.targetIntensity || 6,
    equipment: seed.inputs?.equipment || [],
    constraints: seed.inputs?.constraints || [],
    // Add any context if available
    recentPRs: opts?.recentPRs || [],
    lastWorkouts: opts?.lastWorkouts || [],
    todaysReport: opts?.todaysReport
  };

  // Generate using legacy system
  const workout = await legacyGenerateWorkout(legacyRequest);
  
  // Convert back to format expected by new system
  return {
    workout: {
      id: `workout-${seed.rngSeed || Date.now()}`,
      name: workout.name,
      description: workout.description || `${workout.category} workout`,
      totalMinutes: workout.duration,
      estimatedIntensity: workout.intensity,
      blocks: workout.sets?.map((set: any, index: number) => ({
        id: `block-${index}`,
        name: set.exercise || `Exercise ${index + 1}`,
        type: index === 0 ? 'warmup' : (index === workout.sets.length - 1 ? 'cooldown' : 'main'),
        structure: 'sequence',
        exercises: [{
          id: set.id || `ex-${index}`,
          name: set.exercise,
          movement: { id: `mov-${index}`, name: set.exercise },
          sets: set.sets || 1,
          reps: set.reps || '8-12',
          load: set.weight ? `${set.weight}` : undefined,
          duration: set.duration,
          notes: set.notes || ''
        }],
        notes: set.notes || ''
      })) || [],
      coaching_notes: workout.description || 'Focus on proper form and controlled movement.',
      metadata: {
        template: 'legacy',
        patterns: [],
        equipment: legacyRequest.equipment,
        progression: 'legacy'
      }
    },
    choices: {
      templateId: 'legacy',
      movementPoolIds: [],
      schemeId: 'default'
    }
  };
}