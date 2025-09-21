import { z } from 'zod';

// Base enums and constants
export const CategoryEnum = z.enum([
  'CrossFit',
  'Olympic', 
  'Powerlifting',
  'Bodybuilding',
  'Gymnastics',
  'Endurance'
]);

export const LoadUnitEnum = z.enum(['lb', 'kg', 'bw', '%1RM']);

// LoadSpec for weights and resistances
export const LoadSpecSchema = z.object({
  unit: LoadUnitEnum,
  value: z.number().positive(),
  ref_1rm_of: z.string().optional() // Required when unit is '%1RM'
}).refine(
  (data) => data.unit !== '%1RM' || data.ref_1rm_of,
  { message: "%1RM requires ref_1rm_of field" }
);

// ComplexSpec for complex movements like 1+2 Power Clean + Front Squat
export const ComplexSpecSchema = z.object({
  parts: z.array(z.object({
    name: z.string(),
    reps: z.number().int().positive()
  })).min(2)
});

// MovementSpec for individual movements
export const MovementSpecSchema = z.object({
  name: z.string(),
  reps: z.number().int().positive().optional(),
  reps_scheme: z.string().optional(), // e.g., "27-21-15-9", "5-5-3-3-1"
  load: LoadSpecSchema.optional(),
  height_in: z.number().positive().optional(), // for boxes, etc.
  notes: z.string().optional()
});

// WarmDown for cool-down activities
export const WarmDownSchema = z.object({
  name: z.string(),
  reps: z.number().int().positive().optional(),
  seconds: z.number().int().positive().optional()
});

// WorkoutBlock union types
export const CFAmrapBlockSchema = z.object({
  kind: z.literal('cf_amrap'),
  minutes: z.number().positive(),
  items: z.array(MovementSpecSchema).min(1),
  note: z.string().optional()
});

export const CFForTimeBlockSchema = z.object({
  kind: z.literal('cf_for_time'),
  reps_scheme: z.string(), // e.g., "27-21-15-9"
  items: z.array(MovementSpecSchema).min(1),
  time_cap_min: z.number().positive()
});

export const CFIntervalBlockSchema = z.object({
  kind: z.literal('cf_interval'),
  rounds: z.number().int().positive(),
  work_min: z.number().positive(),
  rest_sec: z.number().int().positive(),
  items: z.array(MovementSpecSchema).min(1)
});

export const StrengthBlockSchema = z.object({
  kind: z.literal('strength'),
  movement: z.string(),
  sets: z.number().int().positive(),
  reps: z.number().int().positive().optional(),
  complex: ComplexSpecSchema.optional(),
  percent_1rm: z.number().min(30).max(120).optional(), // 30-120% range
  load: LoadSpecSchema.optional(),
  rest_sec: z.number().int().positive().optional(),
  note: z.string().optional()
});

export const AccessoryBlockSchema = z.object({
  kind: z.literal('accessory'),
  items: z.array(MovementSpecSchema).min(1)
});

// WorkoutBlock union
export const WorkoutBlockSchema = z.discriminatedUnion('kind', [
  CFAmrapBlockSchema,
  CFForTimeBlockSchema, 
  CFIntervalBlockSchema,
  StrengthBlockSchema,
  AccessoryBlockSchema
]);

// Main Workout schema
export const WorkoutSchema = z.object({
  title: z.string().min(1),
  category: CategoryEnum,
  duration_min: z.number().int().positive(),
  intensity_1_to_10: z.number().min(1).max(10),
  rationale: z.string().optional(),
  blocks: z.array(WorkoutBlockSchema).min(1),
  cool_down: z.array(WarmDownSchema).optional()
}).refine(
  (data) => {
    // Calculate total duration from blocks more accurately
    const totalBlockDuration = data.blocks.reduce((sum, block) => {
      switch (block.kind) {
        case 'cf_amrap':
          return sum + block.minutes;
        case 'cf_for_time':
          // For time workouts typically take 70-80% of time cap
          return sum + (block.time_cap_min * 0.75);
        case 'cf_interval':
          // Total time including rest periods
          return sum + (block.rounds * (block.work_min + block.rest_sec / 60));
        case 'strength':
          // More accurate timing for strength blocks
          const timePerSet = 1.5; // Consistent work time per set
          
          // Handle rest time more realistically
          let restTime = 0;
          if (block.rest_sec) {
            // Half-weight explicit rest to avoid overestimation
            restTime = (block.rest_sec / 60) * (block.sets - 1) * 0.5;
          } else if (block.reps && block.reps <= 2) {
            // Add default rest for singles/doubles when not specified
            const defaultRestMin = block.sets >= 8 ? 2.5 : 1.5;
            restTime = defaultRestMin * (block.sets - 1) * 0.5;
          }
          
          return sum + (block.sets * timePerSet) + restTime;
        case 'accessory':
          // Estimate based on number of movements: 2-3 min per movement
          return sum + (block.items.length * 2.5);
        default:
          return sum;
      }
    }, 0);
    
    // Add 5-10 min for warmup/transitions if not accounted for
    const estimatedWarmup = data.duration_min > 30 ? 5 : 3;
    const totalEstimate = totalBlockDuration + estimatedWarmup;
    
    // Duration must be within ±30% to be realistic for workout variability  
    const tolerance = data.duration_min * 0.30;
    return totalEstimate >= (data.duration_min - tolerance) && 
           totalEstimate <= (data.duration_min + tolerance);
  },
  { message: "Block durations must sum to within ±30% of workout duration" }
);

// Type exports
export type Category = z.infer<typeof CategoryEnum>;
export type LoadUnit = z.infer<typeof LoadUnitEnum>;
export type LoadSpec = z.infer<typeof LoadSpecSchema>;
export type ComplexSpec = z.infer<typeof ComplexSpecSchema>;
export type MovementSpec = z.infer<typeof MovementSpecSchema>;
export type WarmDown = z.infer<typeof WarmDownSchema>;

export type CFAmrapBlock = z.infer<typeof CFAmrapBlockSchema>;
export type CFForTimeBlock = z.infer<typeof CFForTimeBlockSchema>;
export type CFIntervalBlock = z.infer<typeof CFIntervalBlockSchema>;
export type StrengthBlock = z.infer<typeof StrengthBlockSchema>;
export type AccessoryBlock = z.infer<typeof AccessoryBlockSchema>;
export type WorkoutBlock = z.infer<typeof WorkoutBlockSchema>;

export type Workout = z.infer<typeof WorkoutSchema>;

// Validation helpers
export function validateWorkout(workout: unknown): Workout {
  return WorkoutSchema.parse(workout);
}

export function isValidWorkout(workout: unknown): workout is Workout {
  return WorkoutSchema.safeParse(workout).success;
}

// Movement display helpers
export function formatLoad(load: LoadSpec): string {
  switch (load.unit) {
    case 'lb':
      return `${load.value}#`;
    case 'kg':
      return `${load.value}kg`;
    case 'bw':
      return load.value === 1 ? 'BW' : `${load.value}x BW`;
    case '%1RM':
      return `${load.value}% of 1RM ${load.ref_1rm_of}`;
    default:
      return `${load.value}`;
  }
}

export function formatRXPair(male: number, female: number, unit: 'lb' | 'kg' | 'in' = 'lb'): string {
  const suffix = unit === 'lb' ? '#' : unit === 'in' ? 'in' : 'kg';
  return `${male}/${female}${suffix}`;
}

export function formatComplex(complex: ComplexSpec): string {
  return complex.parts.map(part => `${part.reps}`).join('+');
}

// Common RX standards
export const RX_STANDARDS = {
  deadlift: { male: 225, female: 155 },
  thruster: { male: 95, female: 65 },
  wall_ball: { male: 20, female: 14 },
  box_jump: { male: 24, female: 20 },
  kettlebell_swing: { male: 53, female: 35 },
  pull_up: { rx: 'Strict', scaled: 'Assisted' }
} as const;