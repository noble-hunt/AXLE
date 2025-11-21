import { z } from "zod";
import { Category, workoutRequestSchema, type Workout } from '../../shared/schema.js';

// Suggestion system Zod schemas
export const suggestionRationaleSchema = z.object({
  rulesApplied: z.array(z.string()),
  scores: z.object({
    recency: z.number().min(0).max(1),
    weeklyBalance: z.number().min(0).max(1),
    monthlyBalance: z.number().min(0).max(1),
    fatigue: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
  }),
  sources: z.object({
    lastWorkout: z.custom<Workout | null>().optional(),
    weeklyCounts: z.record(z.nativeEnum(Category), z.number()).optional(),
    monthlyCounts: z.record(z.nativeEnum(Category), z.number()).optional(),
    health: z.object({
      hrv: z.number().nullable().optional(),
      sleepScore: z.number().nullable().optional(),
      restingHR: z.number().nullable().optional(),
      stress: z.number().nullable().optional(),
    }).optional(),
  }),
});

export const suggestedWorkoutDataSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  request: workoutRequestSchema,
  rationale: suggestionRationaleSchema,
  workoutId: z.string().nullable().optional(),
});

// Export types inferred from schemas
export type SuggestionRationaleParsed = z.infer<typeof suggestionRationaleSchema>;
export type SuggestedWorkoutDataParsed = z.infer<typeof suggestedWorkoutDataSchema>;

// Re-export the existing WorkoutRequest schema for convenience
export { workoutRequestSchema } from '../../shared/schema.js';
export type WorkoutRequestParsed = z.infer<typeof workoutRequestSchema>;