/**
 * Deterministic workout generator using seeded randomness and block library
 */

import { SeededRandom, generateSeed } from '../lib/seededRandom.js';
import { getBlocks, type WorkoutBlock, type BlockFilter } from './library/index.js';

export interface DeterministicWorkoutRequest {
  goal: string;
  durationMin: number;
  intensity: number;
  equipment: string[];
  seed?: string;
}

export interface DeterministicWorkout {
  title: string;
  est_duration_min: number;
  intensity: string;
  seed: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: number | string;
    rest_sec: number;
    notes: string;
  }>;
  meta: {
    title: string;
    goal: string;
    equipment: string[];
  };
}

/**
 * Generate a deterministic workout using seeded randomness
 */
export function generateDeterministicWorkout(request: DeterministicWorkoutRequest): DeterministicWorkout {
  const { goal, durationMin, intensity, equipment, seed = generateSeed() } = request;
  const rng = new SeededRandom(seed);

  // Map goal to experience level and block types
  const experienceMap: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
    'Strength': 'intermediate',
    'Conditioning': 'intermediate', 
    'Hypertrophy': 'intermediate',
    'Mobility': 'beginner',
    'Mixed': 'intermediate'
  };

  const experience = experienceMap[goal] || 'intermediate';

  // Get available blocks based on equipment and goal
  const filter: BlockFilter = {
    equipment,
    experience,
    maxDuration: Math.floor(durationMin / 3) // Each block shouldn't be more than 1/3 of total time
  };

  const availableBlocks = getBlocks(filter);
  
  if (availableBlocks.length === 0) {
    throw new Error('No suitable workout blocks found for the given criteria');
  }

  // Determine workout structure based on duration and goal
  const structure = determineWorkoutStructure(durationMin, goal, rng);
  
  // Select blocks for each part of the workout
  const selectedBlocks: WorkoutBlock[] = [];
  let remainingTime = durationMin;

  for (const blockType of structure.blockTypes) {
    const typeBlocks = availableBlocks.filter(block => block.type === blockType);
    if (typeBlocks.length > 0) {
      const selectedBlock = rng.choice(typeBlocks);
      selectedBlocks.push(selectedBlock);
      remainingTime -= selectedBlock.durationMin;
    }
  }

  // Convert blocks to exercises
  const exercises = selectedBlocks.flatMap(block => 
    convertBlockToExercises(block, intensity, rng)
  );

  // Generate workout title
  const title = generateWorkoutTitle(goal, durationMin, intensity, rng);

  return {
    title,
    est_duration_min: durationMin,
    intensity: `${intensity}/10`,
    seed,
    exercises,
    meta: {
      title,
      goal,
      equipment
    }
  };
}

/**
 * Determine workout structure based on duration and goal
 */
function determineWorkoutStructure(durationMin: number, goal: string, rng: SeededRandom) {
  const structures: Record<string, { blockTypes: Array<'warmup' | 'primary' | 'accessory' | 'conditioning' | 'finisher' | 'cooldown'> }> = {
    'Strength': {
      blockTypes: durationMin >= 45 
        ? ['warmup', 'primary', 'primary', 'accessory', 'cooldown']
        : ['warmup', 'primary', 'accessory']
    },
    'Conditioning': {
      blockTypes: durationMin >= 45
        ? ['warmup', 'conditioning', 'conditioning', 'cooldown']
        : ['warmup', 'conditioning']
    },
    'Hypertrophy': {
      blockTypes: durationMin >= 45
        ? ['warmup', 'primary', 'accessory', 'accessory', 'cooldown']
        : ['warmup', 'primary', 'accessory']
    },
    'Mobility': {
      blockTypes: ['warmup', 'cooldown'] // Mobility-focused
    },
    'Mixed': {
      blockTypes: durationMin >= 45
        ? ['warmup', 'primary', 'conditioning', 'cooldown']
        : ['warmup', 'primary']
    }
  };

  return structures[goal] || structures['Mixed'];
}

/**
 * Convert a workout block to specific exercises
 */
function convertBlockToExercises(
  block: WorkoutBlock, 
  intensity: number, 
  rng: SeededRandom
): Array<{
  name: string;
  sets: number;
  reps: number | string;
  rest_sec: number;
  notes: string;
}> {
  // Select a random variant from the block
  const variant = rng.choice(block.variants);
  
  // Determine sets/reps based on intensity and block type
  const setsReps = determineSetsReps(block.type, intensity, rng);
  
  // Convert movements to exercises
  return variant.movements.map(movement => ({
    name: movement,
    sets: setsReps.sets,
    reps: setsReps.reps,
    rest_sec: setsReps.restSec,
    notes: generateExerciseNotes(movement, block.type, rng)
  }));
}

/**
 * Determine sets and reps based on block type and intensity
 */
function determineSetsReps(blockType: string, intensity: number, rng: SeededRandom) {
  const baseRanges: Record<string, { sets: [number, number], reps: [number, number], rest: [number, number] }> = {
    'warmup': { sets: [1, 2], reps: [8, 12], rest: [30, 45] },
    'primary': { sets: [3, 5], reps: [5, 10], rest: [60, 120] },
    'accessory': { sets: [2, 4], reps: [8, 15], rest: [45, 90] },
    'conditioning': { sets: [3, 5], reps: [10, 20], rest: [30, 60] },
    'finisher': { sets: [2, 3], reps: [15, 25], rest: [15, 30] },
    'cooldown': { sets: [1, 1], reps: [10, 15], rest: [15, 30] }
  };

  const range = baseRanges[blockType] || baseRanges['primary'];
  
  // Adjust based on intensity (higher intensity = more sets, fewer reps, longer rest)
  const intensityFactor = intensity / 10;
  
  const sets = Math.round(range.sets[0] + (range.sets[1] - range.sets[0]) * intensityFactor);
  const reps = Math.round(range.reps[1] - (range.reps[1] - range.reps[0]) * intensityFactor);
  const restSec = Math.round(range.rest[0] + (range.rest[1] - range.rest[0]) * intensityFactor);

  return {
    sets: Math.max(1, sets),
    reps: Math.max(1, reps),
    restSec: Math.max(15, restSec)
  };
}

/**
 * Generate exercise-specific notes
 */
function generateExerciseNotes(movement: string, blockType: string, rng: SeededRandom): string {
  const generalNotes = [
    "Focus on proper form and control",
    "Maintain steady breathing throughout",
    "Keep core engaged",
    "Control the tempo",
    "Focus on full range of motion"
  ];

  const typeSpecificNotes: Record<string, string[]> = {
    'warmup': ["Start light and gradually increase intensity", "Focus on mobility and activation"],
    'primary': ["Use challenging weight", "Focus on strength and power", "Rest fully between sets"],
    'accessory': ["Focus on muscle activation", "Control the movement", "Feel the working muscles"],
    'conditioning': ["Maintain consistent pace", "Push through fatigue", "Focus on endurance"],
    'finisher': ["Give maximum effort", "Push to failure", "Finish strong"],
    'cooldown': ["Relax and stretch", "Focus on recovery", "Breathe deeply"]
  };

  const notes = [...generalNotes, ...(typeSpecificNotes[blockType] || [])];
  return rng.choice(notes);
}

/**
 * Generate a workout title
 */
function generateWorkoutTitle(goal: string, durationMin: number, intensity: number, rng: SeededRandom): string {
  const titleTemplates = [
    `${durationMin}-Minute ${goal} Workout`,
    `${goal} Focus Session`,
    `Intensity ${intensity} ${goal} Training`,
    `${goal} Challenge - ${durationMin} Minutes`,
    `Power ${goal} Workout`
  ];

  return rng.choice(titleTemplates);
}