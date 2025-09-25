/**
 * Warm-up and Cool-down Generation
 * 
 * Builds intelligent warm-up sequences based on main workout patterns
 * and adds appropriate cool-down/recovery elements.
 */

import type { Movement, MovementPattern } from './movementTaxonomy.js';
import { MOVEMENT_LIBRARY, getMovementsByPattern, filterByEquipment, createSeededRandom } from './movementTaxonomy.js';
import type { Equipment } from './movementTaxonomy.js';

export interface WarmupExercise {
  movement: Movement;
  sets: number;
  reps: string;
  duration?: number; // seconds
  intensity: 'light' | 'moderate';
  purpose: 'mobility' | 'activation' | 'preparation';
}

export interface CooldownExercise {
  movement: Movement;
  sets: number;
  reps?: string;
  duration?: number; // seconds
  purpose: 'recovery' | 'restoration' | 'breathing';
}

export interface WarmupPlan {
  exercises: WarmupExercise[];
  totalMinutes: number;
  description: string;
}

export interface CooldownPlan {
  exercises: CooldownExercise[];
  totalMinutes: number;
  description: string;
}

/**
 * Warm-up movement library for preparation
 */
const WARMUP_MOVEMENTS: Movement[] = [
  // Dynamic warm-up movements
  {
    id: 'cat_cow',
    name: 'Cat-Cow Stretch',
    pattern: 'hinge',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'hip_circle',
    name: 'Hip Circles',
    pattern: 'hinge',
    equipment: ['bodyweight'],
    plane: 'multi',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'arm_circle',
    name: 'Arm Circles',
    pattern: 'push',
    equipment: ['bodyweight'],
    plane: 'multi',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'leg_swing',
    name: 'Leg Swings',
    pattern: 'squat',
    equipment: ['bodyweight'],
    plane: 'multi',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'bodyweight_squat',
    name: 'Bodyweight Squat',
    pattern: 'squat',
    equipment: ['bodyweight'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    pattern: 'hinge',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'band_pull_apart',
    name: 'Band Pull Aparts',
    pattern: 'pull',
    equipment: ['bodyweight'],
    plane: 'transverse',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'scap_pushup',
    name: 'Scapular Push-ups',
    pattern: 'push',
    equipment: ['bodyweight', 'floor'],
    plane: 'transverse',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 2
  },
  {
    id: 'world_greatest_stretch',
    name: 'World\'s Greatest Stretch',
    pattern: 'mono',
    equipment: ['bodyweight', 'floor'],
    plane: 'multi',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 2
  },
  {
    id: 'inchworm',
    name: 'Inchworm',
    pattern: 'push',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 2
  }
];

/**
 * Cool-down movement library for recovery
 */
const COOLDOWN_MOVEMENTS: Movement[] = [
  {
    id: 'childs_pose',
    name: 'Child\'s Pose',
    pattern: 'core',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'supine_spinal_twist',
    name: 'Supine Spinal Twist',
    pattern: 'rotation',
    equipment: ['bodyweight', 'floor'],
    plane: 'transverse',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'seated_forward_fold',
    name: 'Seated Forward Fold',
    pattern: 'hinge',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'pigeon_pose',
    name: 'Pigeon Pose',
    pattern: 'hinge',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 2
  },
  {
    id: 'legs_up_wall',
    name: 'Legs Up Wall',
    pattern: 'core',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'box_breathing',
    name: 'Box Breathing',
    pattern: 'core',
    equipment: ['bodyweight'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  },
  {
    id: 'savasana',
    name: 'Savasana (Rest Pose)',
    pattern: 'core',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1
  }
];

/**
 * Generate warm-up plan based on main workout patterns
 */
export function generateWarmup(
  mainWorkoutPatterns: MovementPattern[],
  availableEquipment: Equipment[],
  targetMinutes: number,
  rngSeed: string
): WarmupPlan {
  
  const rng = createSeededRandom(rngSeed + '_warmup');
  const exercises: WarmupExercise[] = [];
  
  // Filter warm-up movements by available equipment
  const availableWarmups = filterByEquipment(WARMUP_MOVEMENTS, availableEquipment);
  
  // Always start with general mobility
  const generalMobility = availableWarmups.filter(m => 
    ['cat_cow', 'hip_circle', 'arm_circle'].includes(m.id)
  );
  
  if (generalMobility.length > 0) {
    const selected = generalMobility[Math.floor(rng() * generalMobility.length)];
    exercises.push({
      movement: selected,
      sets: 1,
      reps: '8-10',
      intensity: 'light',
      purpose: 'mobility'
    });
  }
  
  // Add pattern-specific preparation
  const patternPriority = Array.from(new Set(mainWorkoutPatterns)); // Remove duplicates
  
  for (const pattern of patternPriority.slice(0, 3)) { // Max 3 patterns
    const patternWarmups = availableWarmups.filter(m => 
      m.pattern === pattern && !exercises.some(e => e.movement.id === m.id)
    );
    
    if (patternWarmups.length > 0) {
      const selected = patternWarmups[Math.floor(rng() * patternWarmups.length)];
      exercises.push({
        movement: selected,
        sets: 1,
        reps: pattern === 'core' ? '30-45s' : '5-8',
        duration: pattern === 'core' ? 40 : undefined,
        intensity: 'light',
        purpose: 'preparation'
      });
    }
  }
  
  // Add activation exercises if we have time and equipment
  if (targetMinutes >= 8) {
    const activationMoves = availableWarmups.filter(m => 
      ['glute_bridge', 'scap_pushup', 'band_pull_apart'].includes(m.id) &&
      !exercises.some(e => e.movement.id === m.id)
    );
    
    if (activationMoves.length > 0) {
      const selected = activationMoves[Math.floor(rng() * activationMoves.length)];
      exercises.push({
        movement: selected,
        sets: 2,
        reps: '8-12',
        intensity: 'moderate',
        purpose: 'activation'
      });
    }
  }
  
  // Add dynamic movement if time allows
  if (targetMinutes >= 10) {
    const dynamicMoves = availableWarmups.filter(m => 
      ['inchworm', 'world_greatest_stretch'].includes(m.id) &&
      !exercises.some(e => e.movement.id === m.id)
    );
    
    if (dynamicMoves.length > 0) {
      const selected = dynamicMoves[Math.floor(rng() * dynamicMoves.length)];
      exercises.push({
        movement: selected,
        sets: 1,
        reps: '5-8',
        intensity: 'moderate',
        purpose: 'preparation'
      });
    }
  }
  
  // Calculate actual duration
  const estimatedMinutes = exercises.reduce((total, ex) => {
    const baseTime = ex.sets * (ex.duration || 30); // 30s default per set
    return total + (baseTime / 60);
  }, 0);
  
  return {
    exercises,
    totalMinutes: Math.max(5, Math.min(targetMinutes, estimatedMinutes)),
    description: generateWarmupDescription(mainWorkoutPatterns, exercises.length)
  };
}

/**
 * Generate cool-down plan based on workout intensity
 */
export function generateCooldown(
  workoutIntensity: number,
  mainWorkoutPatterns: MovementPattern[],
  availableEquipment: Equipment[],
  rngSeed: string
): CooldownPlan {
  
  const rng = createSeededRandom(rngSeed + '_cooldown');
  const exercises: CooldownExercise[] = [];
  
  // Determine cool-down duration based on intensity
  const baseMinutes = workoutIntensity >= 7 ? 8 : 5;
  
  // Filter cool-down movements by available equipment
  const availableCooldowns = filterByEquipment(COOLDOWN_MOVEMENTS, availableEquipment);
  
  // Always include breathing if high intensity
  if (workoutIntensity >= 7) {
    const breathingEx = availableCooldowns.find(m => m.id === 'box_breathing');
    if (breathingEx) {
      exercises.push({
        movement: breathingEx,
        sets: 1,
        duration: 180, // 3 minutes
        purpose: 'breathing'
      });
    }
  }
  
  // Add pattern-specific stretches
  const stretchPatterns = getRelevantStretchPatterns(mainWorkoutPatterns);
  
  for (const pattern of stretchPatterns.slice(0, 2)) {
    const patternStretches = availableCooldowns.filter(m => 
      (m.pattern === pattern || (pattern === 'hinge' && m.pattern === 'rotation')) &&
      !exercises.some(e => e.movement.id === m.id)
    );
    
    if (patternStretches.length > 0) {
      const selected = patternStretches[Math.floor(rng() * patternStretches.length)];
      exercises.push({
        movement: selected,
        sets: 1,
        duration: 60, // 1 minute hold
        purpose: 'recovery'
      });
    }
  }
  
  // Add restorative pose
  const restorativeMoves = availableCooldowns.filter(m => 
    ['childs_pose', 'legs_up_wall', 'savasana'].includes(m.id) &&
    !exercises.some(e => e.movement.id === m.id)
  );
  
  if (restorativeMoves.length > 0) {
    const selected = restorativeMoves[Math.floor(rng() * restorativeMoves.length)];
    exercises.push({
      movement: selected,
      sets: 1,
      duration: 120, // 2 minutes
      purpose: 'restoration'
    });
  }
  
  // Calculate actual duration
  const totalSeconds = exercises.reduce((total, ex) => total + (ex.duration || 60), 0);
  const actualMinutes = Math.ceil(totalSeconds / 60);
  
  return {
    exercises,
    totalMinutes: Math.max(baseMinutes, actualMinutes),
    description: generateCooldownDescription(workoutIntensity, exercises.length)
  };
}

/**
 * Get relevant stretch patterns based on main workout
 */
function getRelevantStretchPatterns(mainPatterns: MovementPattern[]): MovementPattern[] {
  const stretchMap: Record<MovementPattern, MovementPattern[]> = {
    'squat': ['hinge', 'core'],
    'hinge': ['hinge', 'rotation'],
    'push': ['core', 'rotation'],
    'pull': ['core', 'rotation'],
    'core': ['core', 'rotation'],
    'mono': ['hinge', 'core'],
    'carry': ['core', 'hinge'],
    'rotation': ['rotation', 'core']
  };
  
  const relevantStretches: MovementPattern[] = [];
  
  for (const pattern of mainPatterns) {
    const stretches = stretchMap[pattern] || ['core'];
    relevantStretches.push(...stretches);
  }
  
  // Remove duplicates and return top priorities
  return Array.from(new Set(relevantStretches)).slice(0, 3);
}

/**
 * Generate descriptive text for warm-up
 */
function generateWarmupDescription(patterns: MovementPattern[], exerciseCount: number): string {
  const patternText = patterns.slice(0, 2).join(' and ');
  return `Dynamic warm-up targeting ${patternText} patterns with ${exerciseCount} preparatory exercises`;
}

/**
 * Generate descriptive text for cool-down
 */
function generateCooldownDescription(intensity: number, exerciseCount: number): string {
  if (intensity >= 7) {
    return `Extended recovery sequence with breathing work and ${exerciseCount} restorative exercises`;
  }
  return `Recovery cool-down with ${exerciseCount} gentle stretches and relaxation`;
}

/**
 * Get recommended warm-up duration based on workout type
 */
export function getRecommendedWarmupDuration(
  workoutIntensity: number,
  workoutType: 'strength' | 'conditioning' | 'endurance' | 'mixed'
): number {
  
  const baseMinutes = {
    'strength': 8,
    'conditioning': 6,
    'endurance': 5,
    'mixed': 7
  }[workoutType];
  
  // Add time for higher intensity
  const intensityBonus = workoutIntensity >= 7 ? 2 : 0;
  
  return baseMinutes + intensityBonus;
}

/**
 * Check if workout needs extended cool-down
 */
export function needsExtendedCooldown(workoutIntensity: number): boolean {
  return workoutIntensity >= 7;
}