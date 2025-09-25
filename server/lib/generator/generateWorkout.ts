/**
 * Main Workout Generation Engine
 * 
 * Orchestrates all components to generate deterministic, progressive workouts
 * using seeded RNG and intelligent adaptation based on user metrics.
 */

import type { GeneratorSeed, GeneratorInputs, GeneratorContext, GeneratorChoices } from '../../../shared/generator-types.js';
import type { WorkoutTemplate } from './templates.js';
import type { Movement, MovementPattern } from './movementTaxonomy.js';
import type { ProgressionDirectives, WorkoutHistory } from './progression.js';
import type { WarmupPlan, CooldownPlan } from './warmupCooldown.js';

import { 
  MOVEMENT_LIBRARY, 
  filterByEquipment, 
  avoidConstraints, 
  sampleBalanced, 
  createSeededRandom, 
  getMovementsByComplexity 
} from './movementTaxonomy.js';

import { 
  selectTemplate, 
  getTemplatesByArchetype, 
  estimateWorkoutTime 
} from './templates.js';

import { 
  getIntensityParameters, 
  createSessionIntensityPlan, 
  applyHealthCaps 
} from './intensity.js';

import { 
  generateProgressionDirectives, 
  convertToWorkoutHistory 
} from './progression.js';

import { 
  generateWarmup, 
  generateCooldown, 
  getRecommendedWarmupDuration, 
  needsExtendedCooldown 
} from './warmupCooldown.js';

export interface GeneratedWorkout {
  id: string;
  name: string;
  description: string;
  totalMinutes: number;
  estimatedIntensity: number;
  blocks: WorkoutBlock[];
  coaching_notes: string;
  metadata: {
    template: string;
    patterns: MovementPattern[];
    equipment: string[];
    progression: string;
  };
}

export interface WorkoutBlock {
  id: string;
  name: string;
  type: 'warmup' | 'main' | 'accessory' | 'conditioning' | 'cooldown';
  structure: string;
  exercises: WorkoutExercise[];
  sets?: number;
  rest_seconds?: number;
  notes?: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  movement: Movement;
  sets: number;
  reps: string;
  load?: string;
  duration?: number;
  notes?: string;
}

export interface GenerationResult {
  workout: GeneratedWorkout;
  choices: GeneratorChoices;
  metadata: {
    templateUsed: string;
    progressionApplied: string;
    intensityCapped: boolean;
    totalMovements: number;
  };
}

/**
 * Main workout generation function
 */
export async function generateWorkout(
  seed: GeneratorSeed,
  workoutHistory: WorkoutHistory[] = []
): Promise<GenerationResult> {
  
  const rng = createSeededRandom(seed.rngSeed);
  const choices: GeneratorChoices = {
    templateId: '',
    movementPoolIds: [],
    schemeId: 'default'
  };
  
  // Apply health-based intensity caps
  const originalIntensity = seed.inputs.targetIntensity;
  const cappedIntensity = applyHealthCaps(originalIntensity, seed.context.healthModifiers || {});
  const intensityCapped = cappedIntensity !== originalIntensity;
  
  // Get progression directives
  const progressionDirectives = await generateProgressionDirectives(seed.context.userId, workoutHistory, seed.inputs.archetype);
  choices.schemeId = progressionDirectives.progressionType;
  
  // Adjust target intensity based on progression
  const adjustedIntensity = Math.max(1, Math.min(10, 
    cappedIntensity + progressionDirectives.intensityAdjustment
  ));
  
  // Select workout template
  const template = selectTemplate(
    seed.inputs.archetype,
    seed.inputs.minutes,
    adjustedIntensity,
    rng
  );
  
  if (!template) {
    throw new Error(`No suitable template found for ${seed.inputs.archetype} workout of ${seed.inputs.minutes} minutes`);
  }
  
  choices.templateId = template.id;
  
  // Get intensity parameters
  const intensityParams = getIntensityParameters(adjustedIntensity, seed.context.healthModifiers);
  
  // Filter movement pool
  const availableMovements = filterMovementPool(
    MOVEMENT_LIBRARY,
    seed.inputs.equipment as any[],
    seed.inputs.constraints || [],
    intensityParams.complexityLimit
  );
  
  // Generate workout blocks
  const blocks: WorkoutBlock[] = [];
  
  // 1. Generate warm-up
  const warmupMinutes = getRecommendedWarmupDuration(adjustedIntensity, seed.inputs.archetype);
  const mainPatterns = extractMainPatterns(template);
  
  const warmupPlan = generateWarmup(
    mainPatterns,
    seed.inputs.equipment as any[],
    warmupMinutes,
    seed.rngSeed
  );
  
  choices.movementPoolIds.push(...warmupPlan.exercises.map(e => e.movement.id));
  
  blocks.push({
    id: 'warmup',
    name: 'Warm-up',
    type: 'warmup',
    structure: 'sequence',
    exercises: warmupPlan.exercises.map(ex => ({
      id: ex.movement.id,
      name: ex.movement.name,
      movement: ex.movement,
      sets: ex.sets,
      reps: ex.reps,
      duration: ex.duration,
      notes: `${ex.purpose} - ${ex.intensity} intensity`
    })),
    notes: warmupPlan.description
  });
  
  // 2. Generate main workout blocks
  for (const templateBlock of template.blocks.filter(b => b.type !== 'warmup' && b.type !== 'cooldown')) {
    const workoutBlock = await generateWorkoutBlock(
      templateBlock,
      availableMovements,
      intensityParams,
      progressionDirectives,
      rng
    );
    
    choices.movementPoolIds.push(...workoutBlock.exercises.map(e => e.movement.id));
    blocks.push(workoutBlock);
  }
  
  // 3. Generate cool-down if needed
  if (needsExtendedCooldown(adjustedIntensity)) {
    const cooldownPlan = generateCooldown(
      adjustedIntensity,
      mainPatterns,
      seed.inputs.equipment as any[],
      seed.rngSeed
    );
    
    choices.movementPoolIds.push(...cooldownPlan.exercises.map(e => e.movement.id));
    
    blocks.push({
      id: 'cooldown',
      name: 'Cool-down',
      type: 'cooldown',
      structure: 'sequence',
      exercises: cooldownPlan.exercises.map(ex => ({
        id: ex.movement.id,
        name: ex.movement.name,
        movement: ex.movement,
        sets: ex.sets,
        reps: ex.reps || 'hold',
        duration: ex.duration,
        notes: `${ex.purpose} - gentle recovery`
      })),
      notes: cooldownPlan.description
    });
  }
  
  // Calculate accurate totals from actual blocks
  const actualTotalMinutes = blocks.reduce((total, block) => {
    if (block.type === 'warmup' || block.type === 'cooldown') {
      // Use warmup/cooldown plan durations
      const planMinutes = block.type === 'warmup' ? warmupMinutes : 
                         (needsExtendedCooldown(adjustedIntensity) ? 8 : 5);
      return total + planMinutes;
    }
    
    // Estimate main blocks based on sets and rest
    if (block.sets && block.rest_seconds) {
      const workTime = block.sets * 1.5; // 1.5 minutes average per set
      const restTime = (block.sets - 1) * (block.rest_seconds / 60);
      return total + workTime + restTime;
    }
    
    return total + 15; // Default fallback
  }, 0);

  // Create workout object with proper finalization
  const workout: GeneratedWorkout = {
    id: `workout-${seed.rngSeed}`,
    name: generateWorkoutName(template, seed.inputs.archetype, adjustedIntensity),
    description: generateWorkoutDescription(template, progressionDirectives, intensityCapped),
    totalMinutes: Math.round(actualTotalMinutes),
    estimatedIntensity: adjustedIntensity,
    blocks,
    coaching_notes: generateCoachingNotes(progressionDirectives, intensityCapped, seed.context),
    metadata: {
      template: template.id,
      patterns: mainPatterns,
      equipment: seed.inputs.equipment,
      progression: progressionDirectives.reasoning
    }
  };

  // Validate workout structure
  validateWorkoutStructure(workout);
  
  const result: GenerationResult = {
    workout,
    choices,
    metadata: {
      templateUsed: template.id,
      progressionApplied: progressionDirectives.progressionType,
      intensityCapped,
      totalMovements: choices.movementPoolIds.length
    }
  };
  
  return result;
}

/**
 * Filter movement pool based on constraints and complexity
 */
function filterMovementPool(
  movements: Movement[],
  equipment: string[],
  constraints: string[],
  maxComplexity: number
): Movement[] {
  let filtered = filterByEquipment(movements, equipment as any[]);
  filtered = avoidConstraints(filtered, constraints);
  filtered = filtered.filter(m => m.complexity <= maxComplexity);
  
  return filtered;
}

/**
 * Extract main movement patterns from template
 */
function extractMainPatterns(template: WorkoutTemplate): MovementPattern[] {
  const patterns: MovementPattern[] = [];
  
  for (const block of template.blocks) {
    for (const slot of block.movements) {
      patterns.push(...slot.patterns);
    }
  }
  
  return Array.from(new Set(patterns)); // Remove duplicates
}

/**
 * Generate individual workout block
 */
async function generateWorkoutBlock(
  templateBlock: any,
  availableMovements: Movement[],
  intensityParams: any,
  progressionDirectives: ProgressionDirectives,
  rng: () => number
): Promise<WorkoutBlock> {
  
  const exercises: WorkoutExercise[] = [];
  
  for (const slot of templateBlock.movements) {
    // Filter movements for this slot
    let slotMovements = availableMovements.filter(m => 
      slot.patterns.includes(m.pattern)
    );
    
    if (slot.compound !== undefined) {
      slotMovements = slotMovements.filter(m => m.compound === slot.compound);
    }
    
    if (slot.unilateral !== undefined) {
      slotMovements = slotMovements.filter(m => m.unilateral === slot.unilateral);
    }
    
    if (slot.energySystem) {
      slotMovements = slotMovements.filter(m => m.energySystem === slot.energySystem);
    }
    
    // Sample movements for this slot
    const selectedMovements = sampleBalanced(slotMovements, slot.count, rng, {
      preferredPatterns: slot.patterns,
      ensureCompound: slot.compound
    });
    
    // If no movements found, try with broader filters
    if (selectedMovements.length === 0) {
      console.warn(`No movements found for slot with patterns: ${slot.patterns.join(', ')}`);
      // Try without compound requirement
      const fallbackMovements = availableMovements.filter(m => 
        slot.patterns.includes(m.pattern)
      );
      
      if (fallbackMovements.length > 0) {
        const fallbackSelected = sampleBalanced(fallbackMovements, Math.min(slot.count, fallbackMovements.length), rng);
        for (const movement of fallbackSelected) {
          const exercise = createExerciseFromMovement(
            movement,
            templateBlock,
            intensityParams,
            progressionDirectives,
            slot.role
          );
          exercises.push(exercise);
        }
      }
    } else {
      // Create exercises from movements
      for (const movement of selectedMovements) {
        const exercise = createExerciseFromMovement(
          movement,
          templateBlock,
          intensityParams,
          progressionDirectives,
          slot.role
        );
        exercises.push(exercise);
      }
    }
  }
  
  return {
    id: templateBlock.id,
    name: templateBlock.id.charAt(0).toUpperCase() + templateBlock.id.slice(1),
    type: templateBlock.type,
    structure: templateBlock.structure,
    exercises,
    sets: templateBlock.sets,
    rest_seconds: templateBlock.rest,
    notes: templateBlock.notes
  };
}

/**
 * Create exercise from movement and template parameters
 */
function createExerciseFromMovement(
  movement: Movement,
  templateBlock: any,
  intensityParams: any,
  progressionDirectives: ProgressionDirectives,
  role: string
): WorkoutExercise {
  
  // Apply progression adjustments
  let sets = templateBlock.sets || 3;
  let reps = templateBlock.reps || '8-12';
  let load = templateBlock.load || 'moderate';
  
  // Volume adjustments
  if (progressionDirectives.volumeAdjustment !== 1.0) {
    sets = Math.max(1, Math.round(sets * progressionDirectives.volumeAdjustment));
  }
  
  // Load adjustments
  if (progressionDirectives.loadAdjustment !== 1.0 && templateBlock.load) {
    if (templateBlock.load.includes('%')) {
      // Adjust percentage ranges
      const percentages = templateBlock.load.match(/\d+/g);
      if (percentages && percentages.length >= 2) {
        const min = Math.round(parseInt(percentages[0]) * progressionDirectives.loadAdjustment);
        const max = Math.round(parseInt(percentages[1]) * progressionDirectives.loadAdjustment);
        load = `${min}-${max}%`;
      }
    }
  }
  
  return {
    id: movement.id,
    name: movement.name,
    movement,
    sets,
    reps,
    load,
    duration: templateBlock.time ? templateBlock.time * 60 : undefined,
    notes: generateExerciseNotes(movement, role, progressionDirectives)
  };
}

/**
 * Generate workout name
 */
function generateWorkoutName(
  template: WorkoutTemplate,
  archetype: string,
  intensity: number
): string {
  const intensityLabels = {
    1: 'Recovery', 2: 'Easy', 3: 'Light', 4: 'Moderate', 5: 'Steady',
    6: 'Challenging', 7: 'Hard', 8: 'Intense', 9: 'Very Hard', 10: 'Maximum'
  };
  
  const intensityLabel = intensityLabels[intensity as keyof typeof intensityLabels] || 'Moderate';
  
  return `${intensityLabel} ${archetype.charAt(0).toUpperCase() + archetype.slice(1)} Workout`;
}

/**
 * Generate workout description
 */
function generateWorkoutDescription(
  template: WorkoutTemplate,
  progressionDirectives: ProgressionDirectives,
  intensityCapped: boolean
): string {
  let description = template.description || `${template.archetype} workout using ${template.name} template`;
  
  if (intensityCapped) {
    description += ' (intensity adjusted based on recovery metrics)';
  }
  
  if (progressionDirectives.progressionType !== 'skill') {
    description += ` with ${progressionDirectives.progressionType} progression`;
  }
  
  return description;
}

/**
 * Generate coaching notes
 */
function generateCoachingNotes(
  progressionDirectives: ProgressionDirectives,
  intensityCapped: boolean,
  context: GeneratorContext
): string {
  const notes: string[] = [];
  
  if (intensityCapped) {
    notes.push('Workout intensity has been adjusted based on your current recovery metrics.');
  }
  
  if (progressionDirectives.deloadRecommended) {
    notes.push('This is a deload session - focus on movement quality and recovery.');
  } else if (progressionDirectives.progressionType === 'load') {
    notes.push('Progressive overload: aim to increase load from your last session.');
  } else if (progressionDirectives.progressionType === 'volume') {
    notes.push('Volume progression: additional sets/reps from previous workout.');
  }
  
  notes.push(progressionDirectives.reasoning);
  
  // Check for stress indicators from health modifiers
  if (context.healthModifiers) {
    const health = context.healthModifiers;
    if (health.axleScore && health.axleScore < 40) {
      notes.push('Low AXLE score detected - prioritize recovery and lighter loads today.');
    }
    if (health.vitality && health.vitality < 35) {
      notes.push('Consider reducing intensity if energy levels remain low.');
    }
  }
  
  // Ensure we always have coaching notes
  if (notes.length === 0) {
    notes.push('Focus on proper form and controlled movement throughout the workout.');
  }
  
  return notes.join(' ');
}

/**
 * Generate exercise-specific notes
 */
function generateExerciseNotes(
  movement: Movement,
  role: string,
  progressionDirectives: ProgressionDirectives
): string {
  const notes: string[] = [];
  
  if (movement.complexity >= 4) {
    notes.push('Focus on technique - complex movement');
  }
  
  if (role === 'primary' && progressionDirectives.progressionType === 'load') {
    notes.push('Aim for slight load increase from last session');
  }
  
  if (movement.unilateral) {
    notes.push('Perform each side');
  }
  
  return notes.join('. ');
}

/**
 * Export function for use in existing codebase
 */
export async function generateDeterministicWorkout(
  inputs: GeneratorInputs,
  context: GeneratorContext,
  rngSeed: string,
  workoutHistory: any[] = []
): Promise<{ workout: any; choices: GeneratorChoices }> {
  
  const seed: GeneratorSeed = {
    rngSeed,
    inputs,
    context,
    generatorVersion: '0.3.0',
    choices: {
      templateId: '',
      movementPoolIds: [],
      schemeId: 'default'
    }
  };
  
  // Convert workout history
  const convertedHistory = workoutHistory.map(convertToWorkoutHistory);
  
  const result = await generateWorkout(seed, convertedHistory);
  
  // Return the full workout object (not legacy format for tests)
  return {
    workout: result.workout,
    choices: result.choices
  };
}

/**
 * Validate workout structure ensures all required fields are present
 */
function validateWorkoutStructure(workout: GeneratedWorkout): void {
  if (!workout.id) throw new Error('Workout missing required field: id');
  if (!workout.name) throw new Error('Workout missing required field: name');
  if (!workout.description) throw new Error('Workout missing required field: description');
  if (!workout.totalMinutes || workout.totalMinutes <= 0) throw new Error('Workout missing valid totalMinutes');
  if (!workout.estimatedIntensity || workout.estimatedIntensity <= 0) throw new Error('Workout missing valid estimatedIntensity');
  if (!workout.blocks || workout.blocks.length === 0) throw new Error('Workout missing blocks');
  if (!workout.coaching_notes) throw new Error('Workout missing coaching_notes');
  if (!workout.metadata) throw new Error('Workout missing metadata');

  // Validate each block
  workout.blocks.forEach((block, index) => {
    if (!block.id) throw new Error(`Block ${index} missing required field: id`);
    if (!block.name) throw new Error(`Block ${index} missing required field: name`);
    if (!block.type) throw new Error(`Block ${index} missing required field: type`);
    if (!block.exercises || block.exercises.length === 0) throw new Error(`Block ${index} missing exercises`);

    // Validate each exercise
    block.exercises.forEach((exercise, exerciseIndex) => {
      if (!exercise.id) throw new Error(`Block ${index} exercise ${exerciseIndex} missing required field: id`);
      if (!exercise.name) throw new Error(`Block ${index} exercise ${exerciseIndex} missing required field: name`);
      if (!exercise.movement) throw new Error(`Block ${index} exercise ${exerciseIndex} missing required field: movement`);
      if (!exercise.sets || exercise.sets <= 0) throw new Error(`Block ${index} exercise ${exerciseIndex} missing valid sets`);
      if (!exercise.reps) throw new Error(`Block ${index} exercise ${exerciseIndex} missing required field: reps`);
    });
  });
}