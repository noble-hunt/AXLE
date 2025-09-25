/**
 * Movement Taxonomy System
 * 
 * Defines a curated set of movements with comprehensive tagging for
 * intelligent workout generation and filtering.
 */

export type MovementPattern = 'hinge' | 'squat' | 'push' | 'pull' | 'core' | 'mono' | 'carry' | 'rotation';
export type Equipment = 'barbell' | 'dumbbell' | 'kettlebell' | 'bodyweight' | 'pull_up_bar' | 'box' | 'floor' | 'rings' | 'rope' | 'bike' | 'rower';
export type Plane = 'sagittal' | 'frontal' | 'transverse' | 'multi';
export type EnergySystem = 'alactic' | 'glycolytic' | 'aerobic' | 'mixed';
export type Loadability = 'high' | 'medium' | 'low' | 'skill';

export interface Movement {
  id: string;
  name: string;
  pattern: MovementPattern;
  equipment: Equipment[];
  plane: Plane;
  energySystem: EnergySystem;
  loadability: Loadability;
  complexity: 1 | 2 | 3 | 4 | 5; // 1=beginner, 5=expert
  unilateral?: boolean;
  compound?: boolean;
  description?: string;
}

/**
 * Curated movement library with comprehensive tagging
 */
export const MOVEMENT_LIBRARY: Movement[] = [
  // HINGE PATTERN
  {
    id: 'deadlift',
    name: 'Deadlift',
    pattern: 'hinge',
    equipment: ['barbell'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'high',
    complexity: 3,
    compound: true
  },
  {
    id: 'kb_swing',
    name: 'Kettlebell Swing',
    pattern: 'hinge',
    equipment: ['kettlebell'],
    plane: 'sagittal',
    energySystem: 'mixed',
    loadability: 'medium',
    complexity: 2,
    compound: true
  },
  {
    id: 'good_morning',
    name: 'Good Morning',
    pattern: 'hinge',
    equipment: ['barbell'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 3,
    compound: true
  },
  {
    id: 'single_leg_rdl',
    name: 'Single Leg RDL',
    pattern: 'hinge',
    equipment: ['dumbbell', 'kettlebell', 'bodyweight'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 4,
    unilateral: true,
    compound: true
  },

  // SQUAT PATTERN
  {
    id: 'back_squat',
    name: 'Back Squat',
    pattern: 'squat',
    equipment: ['barbell'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'high',
    complexity: 3,
    compound: true
  },
  {
    id: 'front_squat',
    name: 'Front Squat',
    pattern: 'squat',
    equipment: ['barbell'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'high',
    complexity: 4,
    compound: true
  },
  {
    id: 'goblet_squat',
    name: 'Goblet Squat',
    pattern: 'squat',
    equipment: ['dumbbell', 'kettlebell'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 2,
    compound: true
  },
  {
    id: 'air_squat',
    name: 'Air Squat',
    pattern: 'squat',
    equipment: ['bodyweight'],
    plane: 'sagittal',
    energySystem: 'mixed',
    loadability: 'low',
    complexity: 1,
    compound: true
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    pattern: 'squat',
    equipment: ['dumbbell', 'bodyweight', 'box'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 3,
    unilateral: true,
    compound: true
  },

  // PUSH PATTERN
  {
    id: 'bench_press',
    name: 'Bench Press',
    pattern: 'push',
    equipment: ['barbell'],
    plane: 'transverse',
    energySystem: 'alactic',
    loadability: 'high',
    complexity: 3,
    compound: true
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    pattern: 'push',
    equipment: ['barbell'],
    plane: 'frontal',
    energySystem: 'alactic',
    loadability: 'high',
    complexity: 3,
    compound: true
  },
  {
    id: 'dumbbell_press',
    name: 'Dumbbell Press',
    pattern: 'push',
    equipment: ['dumbbell'],
    plane: 'transverse',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 2,
    compound: true
  },
  {
    id: 'push_up',
    name: 'Push-up',
    pattern: 'push',
    equipment: ['bodyweight', 'floor'],
    plane: 'transverse',
    energySystem: 'mixed',
    loadability: 'low',
    complexity: 2,
    compound: true
  },
  {
    id: 'handstand_push_up',
    name: 'Handstand Push-up',
    pattern: 'push',
    equipment: ['bodyweight'],
    plane: 'frontal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 5,
    compound: true
  },

  // PULL PATTERN
  {
    id: 'pull_up',
    name: 'Pull-up',
    pattern: 'pull',
    equipment: ['pull_up_bar'],
    plane: 'frontal',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 3,
    compound: true
  },
  {
    id: 'chin_up',
    name: 'Chin-up',
    pattern: 'pull',
    equipment: ['pull_up_bar'],
    plane: 'frontal',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 3,
    compound: true
  },
  {
    id: 'bent_over_row',
    name: 'Bent Over Row',
    pattern: 'pull',
    equipment: ['barbell'],
    plane: 'transverse',
    energySystem: 'alactic',
    loadability: 'high',
    complexity: 3,
    compound: true
  },
  {
    id: 'dumbbell_row',
    name: 'Dumbbell Row',
    pattern: 'pull',
    equipment: ['dumbbell'],
    plane: 'transverse',
    energySystem: 'alactic',
    loadability: 'medium',
    complexity: 2,
    compound: true
  },

  // CORE PATTERN
  {
    id: 'plank',
    name: 'Plank',
    pattern: 'core',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 1,
    compound: false
  },
  {
    id: 'dead_bug',
    name: 'Dead Bug',
    pattern: 'core',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'alactic',
    loadability: 'low',
    complexity: 2,
    compound: false
  },
  {
    id: 'hollow_rock',
    name: 'Hollow Rock',
    pattern: 'core',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'glycolytic',
    loadability: 'low',
    complexity: 2,
    compound: false
  },

  // MONO/UNILATERAL PATTERN
  {
    id: 'single_arm_farmer_walk',
    name: 'Single Arm Farmer Walk',
    pattern: 'mono',
    equipment: ['dumbbell', 'kettlebell'],
    plane: 'multi',
    energySystem: 'mixed',
    loadability: 'medium',
    complexity: 2,
    unilateral: true,
    compound: true
  },
  {
    id: 'walking_lunge',
    name: 'Walking Lunge',
    pattern: 'mono',
    equipment: ['dumbbell', 'bodyweight'],
    plane: 'sagittal',
    energySystem: 'mixed',
    loadability: 'medium',
    complexity: 2,
    unilateral: true,
    compound: true
  },

  // CARRY PATTERN
  {
    id: 'farmer_walk',
    name: 'Farmer Walk',
    pattern: 'carry',
    equipment: ['dumbbell', 'kettlebell'],
    plane: 'sagittal',
    energySystem: 'mixed',
    loadability: 'medium',
    complexity: 1,
    compound: true
  },

  // CONDITIONING MOVEMENTS
  {
    id: 'burpee',
    name: 'Burpee',
    pattern: 'squat',
    equipment: ['bodyweight', 'floor'],
    plane: 'multi',
    energySystem: 'glycolytic',
    loadability: 'low',
    complexity: 2,
    compound: true
  },
  {
    id: 'mountain_climber',
    name: 'Mountain Climber',
    pattern: 'core',
    equipment: ['bodyweight', 'floor'],
    plane: 'sagittal',
    energySystem: 'glycolytic',
    loadability: 'low',
    complexity: 1,
    compound: true
  },
  {
    id: 'bike_erg',
    name: 'Bike Erg',
    pattern: 'squat',
    equipment: ['bike'],
    plane: 'sagittal',
    energySystem: 'aerobic',
    loadability: 'low',
    complexity: 1,
    compound: true
  },
  {
    id: 'row_erg',
    name: 'Rowing Erg',
    pattern: 'pull',
    equipment: ['rower'],
    plane: 'sagittal',
    energySystem: 'aerobic',
    loadability: 'low',
    complexity: 2,
    compound: true
  }
];

/**
 * Filter movements by available equipment
 */
export function filterByEquipment(movements: Movement[], availableEquipment: Equipment[]): Movement[] {
  return movements.filter(movement => 
    movement.equipment.some(eq => availableEquipment.includes(eq))
  );
}

/**
 * Filter out movements that violate user constraints
 */
export function avoidConstraints(movements: Movement[], constraints: string[]): Movement[] {
  const constraintMap: Record<string, (movement: Movement) => boolean> = {
    'no_weights': (m) => m.equipment.every(eq => eq === 'bodyweight' || eq === 'floor' || eq === 'pull_up_bar'),
    'no_barbell': (m) => !m.equipment.includes('barbell'),
    'no_floor': (m) => !m.equipment.includes('floor'),
    'low_impact': (m) => !['burpee', 'mountain_climber', 'box_jump'].includes(m.id),
    'upper_only': (m) => ['push', 'pull', 'core'].includes(m.pattern),
    'lower_only': (m) => ['squat', 'hinge', 'mono', 'carry'].includes(m.pattern)
  };

  return movements.filter(movement => 
    constraints.every(constraint => {
      const filter = constraintMap[constraint];
      return !filter || filter(movement);
    })
  );
}

/**
 * Create seeded random number generator
 */
export function createSeededRandom(seed: string) {
  // Simple seeded PRNG using seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  let state = Math.abs(hash);
  
  return function() {
    // Linear congruential generator
    state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
    return state / Math.pow(2, 32);
  };
}

/**
 * Sample movements with balanced pattern distribution using seeded RNG
 */
export function sampleBalanced(
  pool: Movement[], 
  count: number, 
  rng: () => number,
  options: {
    preferredPatterns?: MovementPattern[];
    maxPerPattern?: number;
    ensureCompound?: boolean;
  } = {}
): Movement[] {
  const { preferredPatterns = [], maxPerPattern = 2, ensureCompound = true } = options;
  
  if (pool.length === 0 || count <= 0) return [];
  
  const selected: Movement[] = [];
  const patternCounts: Record<MovementPattern, number> = {
    hinge: 0, squat: 0, push: 0, pull: 0, core: 0, mono: 0, carry: 0, rotation: 0
  };
  
  // Priority list: preferred patterns first, then others
  const patterns: MovementPattern[] = [
    ...preferredPatterns,
    ...Object.keys(patternCounts).filter(p => !preferredPatterns.includes(p as MovementPattern)) as MovementPattern[]
  ];
  
  // If ensuring compound movements, prioritize them first
  let availablePool = ensureCompound && selected.length === 0 
    ? pool.filter(m => m.compound)
    : pool;
  
  for (let i = 0; i < count && availablePool.length > 0; i++) {
    // Find movements for patterns that haven't hit their max
    let candidates = availablePool.filter(m => 
      patternCounts[m.pattern] < maxPerPattern &&
      !selected.some(s => s.id === m.id)
    );
    
    // If no candidates within pattern limits, expand pool
    if (candidates.length === 0) {
      candidates = availablePool.filter(m => !selected.some(s => s.id === m.id));
    }
    
    if (candidates.length === 0) break;
    
    // Select movement using seeded randomness
    const randomIndex = Math.floor(rng() * candidates.length);
    const selectedMovement = candidates[randomIndex];
    
    selected.push(selectedMovement);
    patternCounts[selectedMovement.pattern]++;
    
    // After first compound movement, open up full pool
    if (ensureCompound && selected.length === 1) {
      availablePool = pool;
    }
  }
  
  return selected;
}

/**
 * Get movements by pattern
 */
export function getMovementsByPattern(pattern: MovementPattern): Movement[] {
  return MOVEMENT_LIBRARY.filter(m => m.pattern === pattern);
}

/**
 * Get movements by energy system
 */
export function getMovementsByEnergySystem(energySystem: EnergySystem): Movement[] {
  return MOVEMENT_LIBRARY.filter(m => m.energySystem === energySystem);
}

/**
 * Get movements by complexity level
 */
export function getMovementsByComplexity(maxComplexity: number): Movement[] {
  return MOVEMENT_LIBRARY.filter(m => m.complexity <= maxComplexity);
}