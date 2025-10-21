// shared/workoutSchema.ts
import { z } from "zod";

export const MovementZ = z.object({
  id: z.string(),                  // "pushup"
  name: z.string(),                // "Push-up"
  equipment: z.array(z.string()),  // ["bodyweight"] | ["dumbbell"] | ["kettlebell"] | ["barbell"]
  tags: z.array(z.string()),       // ["push","upper","hinge","core","mono","warmup"]
});

export const PrescriptionZ = z.object({
  type: z.enum(["reps","time","distance"]), // dosing modality
  sets: z.number().int().min(1),            // 3
  reps: z.number().int().min(1).optional(), // if type="reps"
  seconds: z.number().int().min(5).optional(), // if type="time"
  meters: z.number().int().min(10).optional(), // if type="distance"
  calories: z.number().int().min(1).optional(), // if type="distance" (alternative to meters for cardio)
  load: z.string().optional(),              // "2x20lb", "bodyweight", "RPE 8"
  restSec: z.number().int().min(0).default(0),
  tempo: z.string().optional(),             // "30X1"
  notes: z.string().optional(),
});

export const BlockItemZ = z.object({
  movementId: z.string(),           // references MovementZ.id
  name: z.string(),
  prescription: PrescriptionZ,
});

export const BlockZ = z.object({
  key: z.enum(["warmup","main","cooldown","accessory"]).or(z.string()),
  title: z.string(),
  items: z.array(BlockItemZ).min(1),   // never empty
  targetSeconds: z.number().int().min(60), // planned time for block
  style: z.enum(["straight-sets","emom","amrap","interval","circuit"]).optional(),
  // Wodify-style enhancements
  workoutTitle: z.string().optional(),  // Creative name for main blocks (e.g., "FRUIT LOOPS IN MY ORANGE JUICE")
  scoreType: z.string().optional(),     // "For Time", "AMRAP", "EMOM", "Score Weight", "Score Rounds", etc.
  coachingCues: z.string().optional(),  // Short goal-oriented description with workout intent
  scalingNotes: z.string().optional(),  // Quick scaling suggestions (lighter weight, reduced complexity, etc.)
});

export const WorkoutPlanZ = z.object({
  id: z.string().optional(),        // will exist after save
  seed: z.string(),                 // for determinism
  focus: z.enum([
    "strength", "conditioning", "mixed", "endurance",
    "crossfit", "olympic_weightlifting", "powerlifting",
    "bb_full_body", "bb_upper", "bb_lower",
    "aerobic", "gymnastics", "mobility"
  ]),
  durationMin: z.number().int().min(10).max(120),
  intensity: z.number().int().min(1).max(10),
  equipment: z.array(z.string()),   // from user
  blocks: z.array(BlockZ).min(2),
  totalSeconds: z.number().int().min(300),
  summary: z.string(),              // human synopsis
  version: z.literal(1),
});

export type Movement = z.infer<typeof MovementZ>;
export type Prescription = z.infer<typeof PrescriptionZ>;
export type BlockItem = z.infer<typeof BlockItemZ>;
export type Block = z.infer<typeof BlockZ>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanZ>;