import { z } from 'zod';

// Enums for strict validation
export const CategoryEnum = z.enum([
  'CrossFit/HIIT',
  'Powerlifting', 
  'Olympic',
  'Bodybuilding_Upper',
  'Bodybuilding_Lower', 
  'Bodybuilding_Full',
  'Gymnastics',
  'Aerobic'
]);

export const FormatEnum = z.enum([
  'emom',      // Every Minute on the Minute
  'amrap',     // As Many Rounds As Possible
  'for_time',  // For Time
  'intervals', // Interval Training
  'steady',    // Steady State
  'complex',   // Complex Training
  'superset',  // Superset
  'giantset'   // Giant Set
]);

// Movement whitelists by category
const CROSSFIT_MOVEMENTS = [
  'air_squat', 'back_squat', 'front_squat', 'overhead_squat', 'thruster',
  'deadlift', 'sumo_deadlift', 'romanian_deadlift',
  'press', 'push_press', 'push_jerk', 'split_jerk',
  'pull_up', 'chin_up', 'chest_to_bar', 'muscle_up',
  'push_up', 'handstand_push_up', 'burpee', 'box_jump',
  'kettlebell_swing', 'kettlebell_snatch', 'kettlebell_clean',
  'rowing', 'running', 'assault_bike', 'ski_erg',
  'wall_ball', 'ball_slam', 'rope_climb', 'double_under'
];

const POWERLIFTING_MOVEMENTS = [
  'back_squat', 'front_squat', 'pause_squat', 'box_squat',
  'conventional_deadlift', 'sumo_deadlift', 'deficit_deadlift', 'rack_pull',
  'bench_press', 'close_grip_bench', 'incline_bench', 'pause_bench',
  'overhead_press', 'push_press', 'pin_press',
  'barbell_row', 'pendlay_row', 'chest_supported_row',
  'good_morning', 'stiff_leg_deadlift', 'romanian_deadlift'
];

const OLYMPIC_MOVEMENTS = [
  'snatch', 'clean_and_jerk', 'clean', 'jerk',
  'power_snatch', 'power_clean', 'hang_snatch', 'hang_clean',
  'snatch_pull', 'clean_pull', 'snatch_deadlift', 'clean_deadlift',
  'overhead_squat', 'front_squat', 'back_squat',
  'push_press', 'push_jerk', 'split_jerk', 'squat_jerk'
];

const BODYBUILDING_MOVEMENTS = [
  // Upper
  'bench_press', 'incline_bench', 'decline_bench', 'dumbbell_press',
  'shoulder_press', 'lateral_raise', 'rear_delt_fly', 'upright_row',
  'pull_up', 'lat_pulldown', 'barbell_row', 'dumbbell_row', 'cable_row',
  'bicep_curl', 'hammer_curl', 'preacher_curl', 'cable_curl',
  'tricep_extension', 'close_grip_bench', 'dips', 'cable_pushdown',
  // Lower  
  'squat', 'leg_press', 'bulgarian_split_squat', 'walking_lunge',
  'romanian_deadlift', 'leg_curl', 'stiff_leg_deadlift',
  'calf_raise', 'seated_calf_raise', 'leg_extension',
  // Full
  'deadlift', 'thruster', 'clean_and_press', 'turkish_getup'
];

const GYMNASTICS_MOVEMENTS = [
  'handstand', 'handstand_walk', 'handstand_push_up',
  'muscle_up', 'ring_muscle_up', 'pull_up', 'chin_up',
  'dips', 'ring_dips', 'push_up', 'pike_push_up',
  'l_sit', 'v_sit', 'tuck_planche', 'front_lever',
  'back_lever', 'human_flag', 'pistol_squat',
  'rope_climb', 'pegboard_climb'
];

const AEROBIC_MOVEMENTS = [
  'running', 'jogging', 'walking', 'sprints',
  'cycling', 'stationary_bike', 'assault_bike',
  'rowing', 'swimming', 'elliptical',
  'stair_climber', 'ski_erg', 'versa_climber'
];

const MOVEMENT_WHITELIST = {
  'CrossFit/HIIT': CROSSFIT_MOVEMENTS,
  'Powerlifting': POWERLIFTING_MOVEMENTS, 
  'Olympic': OLYMPIC_MOVEMENTS,
  'Bodybuilding_Upper': BODYBUILDING_MOVEMENTS,
  'Bodybuilding_Lower': BODYBUILDING_MOVEMENTS,
  'Bodybuilding_Full': BODYBUILDING_MOVEMENTS,
  'Gymnastics': GYMNASTICS_MOVEMENTS,
  'Aerobic': AEROBIC_MOVEMENTS
};

// Core schemas
export const MovementSpecSchema = z.object({
  name: z.string().min(1, "Movement name required"),
  category: CategoryEnum,
  reps: z.number().int().min(1).max(500).optional(),
  sets: z.number().int().min(1).max(20).optional(),
  weight_kg: z.number().min(0).max(500).optional(),
  weight_percent_1rm: z.number().min(0).max(120).optional(),
  duration_seconds: z.number().int().min(1).max(7200).optional(),
  distance_meters: z.number().min(0).max(50000).optional(),
  rest_seconds: z.number().int().min(0).max(600).optional(),
  notes: z.string().optional()
}).refine((data) => {
  // Validate movement is in category whitelist
  const allowedMovements = MOVEMENT_WHITELIST[data.category];
  return allowedMovements.includes(data.name);
}, {
  message: "Movement not allowed for this category"
});

export const SetSpecSchema = z.object({
  rounds: z.number().int().min(1).max(50),
  movements: z.array(MovementSpecSchema).min(1).max(10),
  rest_between_rounds_seconds: z.number().int().min(0).max(600).optional(),
  time_cap_seconds: z.number().int().min(30).max(7200).optional()
});

export const WarmupStepSchema = z.object({
  movement: z.string().min(1),
  duration_seconds: z.number().int().min(30).max(900),
  intensity_percent: z.number().min(10).max(70),
  notes: z.string().optional()
});

export const CooldownStepSchema = z.object({
  movement: z.string().min(1),
  duration_seconds: z.number().int().min(60).max(900),
  notes: z.string().optional()
});

export const WorkoutBlockSchema = z.object({
  name: z.string().min(1, "Block name required"),
  type: z.enum(['warmup', 'main', 'accessory', 'cooldown']),
  estimated_duration_min: z.number().min(1).max(60),
  format: FormatEnum.optional(),
  sets: z.array(SetSpecSchema).min(1).max(10).optional(),
  warmup_steps: z.array(WarmupStepSchema).optional(),
  cooldown_steps: z.array(CooldownStepSchema).optional()
}).refine((data) => {
  // Warmup blocks must have warmup_steps
  if (data.type === 'warmup') {
    return data.warmup_steps && data.warmup_steps.length > 0;
  }
  // Cooldown blocks must have cooldown_steps  
  if (data.type === 'cooldown') {
    return data.cooldown_steps && data.cooldown_steps.length > 0;
  }
  // Main/accessory blocks must have sets
  if (data.type === 'main' || data.type === 'accessory') {
    return data.sets && data.sets.length > 0;
  }
  return true;
}, {
  message: "Block type must match its content structure"
});

export const WorkoutSchema = z.object({
  name: z.string().min(1, "Workout name required"),
  category: CategoryEnum,
  format: FormatEnum,
  duration_min: z.number().int().min(10).max(120),
  intensity_1_to_10: z.number().int().min(1).max(10),
  description: z.string().min(10, "Description must be at least 10 characters"),
  blocks: z.array(WorkoutBlockSchema).min(1).max(8),
  equipment_needed: z.array(z.string()).optional(),
  coaching_notes: z.string().optional()
}).refine((data) => {
  // Blocks duration must sum to within ±10% of total duration
  const totalBlockDuration = data.blocks.reduce((sum, block) => sum + block.estimated_duration_min, 0);
  const tolerance = data.duration_min * 0.1;
  const minDuration = data.duration_min - tolerance;
  const maxDuration = data.duration_min + tolerance;
  
  return totalBlockDuration >= minDuration && totalBlockDuration <= maxDuration;
}, {
  message: "Block durations must sum to within ±10% of total workout duration"
}).refine((data) => {
  // Validate movement constraints by category and intensity
  for (const block of data.blocks) {
    if (!block.sets) continue;
    
    for (const set of block.sets) {
      for (const movement of set.movements) {
        // Enforce that movement category matches workout category
        if (movement.category !== data.category) {
          return false;
        }
        
        // Powerlifting/Olympic intensity validation
        if ((data.category === 'Powerlifting' || data.category === 'Olympic') && movement.weight_percent_1rm) {
          const validRanges = getValidPercentRanges(data.category, data.intensity_1_to_10);
          if (movement.weight_percent_1rm < validRanges.min || movement.weight_percent_1rm > validRanges.max) {
            return false;
          }
        }
        
        // Rep validation for strength movements
        if ((data.category === 'Powerlifting' || data.category === 'Olympic') && movement.reps) {
          if (movement.reps < 1 || movement.reps > 12) {
            return false;
          }
        }
        
        // Require at least one concrete prescription
        if (!movement.reps && !movement.duration_seconds && !movement.distance_meters) {
          return false;
        }
      }
    }
  }
  return true;
}, {
  message: "Movement parameters don't match category and intensity requirements, or missing concrete prescriptions"
});

// Helper function for %1RM validation
function getValidPercentRanges(category: string, intensity: number): { min: number; max: number } {
  if (category === 'Powerlifting' || category === 'Olympic') {
    switch (intensity) {
      case 1:
      case 2: return { min: 40, max: 55 }; // Recovery/technique
      case 3:
      case 4: return { min: 55, max: 70 }; // Light training
      case 5:
      case 6: return { min: 65, max: 80 }; // Moderate training
      case 7:
      case 8: return { min: 75, max: 90 }; // Heavy training
      case 9:
      case 10: return { min: 85, max: 100 }; // Max effort
      default: return { min: 50, max: 85 };
    }
  }
  return { min: 0, max: 100 };
}

// User context builder
export function buildUserContextString(input: {
  yesterday?: any;
  week_summary?: any;
  month_summary?: any;
  health_snapshot?: any;
  equipment?: string[];
  constraints?: string[];
}): string {
  const sections: string[] = [];
  
  if (input.yesterday) {
    sections.push(`Yesterday: ${input.yesterday.category || 'Rest'} workout, ${input.yesterday.duration || 0}min, intensity ${input.yesterday.intensity || 'N/A'}/10`);
  }
  
  if (input.week_summary) {
    const weekCounts = Object.entries(input.week_summary.category_counts || {})
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    sections.push(`This week: ${weekCounts}, Total volume: ${input.week_summary.total_volume || 0}min`);
    
    if (input.week_summary.last_heavy_lift) {
      sections.push(`Last heavy lift: ${input.week_summary.last_heavy_lift}`);
    }
  }
  
  if (input.month_summary) {
    const monthCounts = Object.entries(input.month_summary.category_counts || {})
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    sections.push(`This month: ${monthCounts}, Total volume: ${input.month_summary.total_volume || 0}min`);
  }
  
  if (input.health_snapshot) {
    const health = input.health_snapshot;
    const healthLabels: string[] = [];
    
    if (health.hrv !== undefined) {
      const hrvLabel = health.hrv > 50 ? 'good' : health.hrv > 30 ? 'neutral' : 'caution';
      healthLabels.push(`HRV: ${hrvLabel}`);
    }
    
    if (health.resting_hr !== undefined) {
      const rhrLabel = health.resting_hr < 60 ? 'good' : health.resting_hr < 80 ? 'neutral' : 'caution';
      healthLabels.push(`Resting HR: ${rhrLabel}`);
    }
    
    if (health.sleep_score !== undefined) {
      const sleepLabel = health.sleep_score > 80 ? 'good' : health.sleep_score > 60 ? 'neutral' : 'caution';
      healthLabels.push(`Sleep: ${sleepLabel}`);
    }
    
    if (health.stress_flag) {
      healthLabels.push('Stress: caution');
    }
    
    if (healthLabels.length > 0) {
      sections.push(`Health: ${healthLabels.join(', ')}`);
    }
  }
  
  if (input.equipment && input.equipment.length > 0) {
    sections.push(`Equipment: ${input.equipment.join(', ')}`);
  }
  
  if (input.constraints && input.constraints.length > 0) {
    sections.push(`Constraints: ${input.constraints.join(', ')}`);
  }
  
  return sections.join('\n');
}

// Intensity guidelines
export function intensityGuidelines(category: string, intensity: number): string {
  if (category === 'Powerlifting' || category === 'Olympic') {
    switch (intensity) {
      case 1:
      case 2:
        return "Recovery/Technique: 40-55% 1RM, 8-12 reps, focus on form and movement quality";
      case 3:
      case 4:
        return "Light Training: 55-70% 1RM, 5-8 reps, build volume with good technique";
      case 5:
      case 6:
        return "Moderate Training: 65-80% 1RM, 3-6 reps, working sets with manageable load";
      case 7:
      case 8:
        return "Heavy Training: 75-90% 1RM, 1-5 reps, challenging but controlled lifts";
      case 9:
      case 10:
        return "Max Effort: 85-100% 1RM, 1-3 reps, singles/doubles at competition intensity";
      default:
        return "Moderate Training: 65-80% 1RM, 3-6 reps";
    }
  }
  
  if (category === 'Aerobic') {
    switch (intensity) {
      case 1:
      case 2:
        return "Active Recovery: Zone 1, very easy pace, conversational";
      case 3:
      case 4:
        return "Easy Aerobic: Zone 2, comfortable pace, nose breathing";
      case 5:
      case 6:
        return "Moderate Aerobic: Zone 3, comfortably hard, some mouth breathing";
      case 7:
      case 8:
        return "Threshold: Zone 4, hard but sustainable, 15-60min efforts";
      case 9:
      case 10:
        return "VO2 Max: Zone 5, very hard, 3-8min intervals with rest";
      default:
        return "Moderate Aerobic: Zone 3, comfortably hard pace";
    }
  }
  
  if (category === 'CrossFit/HIIT') {
    switch (intensity) {
      case 1:
      case 2:
        return "Recovery: RPE 3-4, easy pace, focus on movement quality";
      case 3:
      case 4:
        return "Moderate: RPE 5-6, sustainable pace, 15-20min time caps";
      case 5:
      case 6:
        return "Challenging: RPE 6-7, hard but manageable, 8-15min workouts";
      case 7:
      case 8:
        return "High Intensity: RPE 7-8, aggressive pace, 5-12min workouts";
      case 9:
      case 10:
        return "All Out: RPE 9-10, maximum effort, 1-8min sprint workouts";
      default:
        return "Challenging: RPE 6-7, hard but manageable effort";
    }
  }
  
  return `Intensity ${intensity}/10: Adjust effort and load appropriately for this category`;
}

// Export types
export type Category = z.infer<typeof CategoryEnum>;
export type Format = z.infer<typeof FormatEnum>;
export type MovementSpec = z.infer<typeof MovementSpecSchema>;
export type SetSpec = z.infer<typeof SetSpecSchema>;
export type WarmupStep = z.infer<typeof WarmupStepSchema>;
export type CooldownStep = z.infer<typeof CooldownStepSchema>;
export type WorkoutBlock = z.infer<typeof WorkoutBlockSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;