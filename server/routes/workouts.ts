import { Router } from "express";
import { z } from "zod";
import { WorkoutPlanZ } from "../../shared/workoutSchema";
import { adaptToPlanV1 } from "../workouts/adapter";
import { generatePlan } from "../workouts/generate";
export const workouts = Router();

const PreviewSchema = z.object({
  focus: z.enum([
    "strength", "conditioning", "mixed", "endurance",
    "crossfit", "olympic_weightlifting", "powerlifting",
    "bb_full_body", "bb_upper", "bb_lower",
    "aerobic", "gymnastics", "mobility"
  ]),
  durationMin: z.coerce.number().int().min(10).max(120), // Align with WorkoutPlanZ
  equipment: z.array(z.string()).default([]),
  intensity: z.coerce.number().int().min(1).max(10), // Align with WorkoutPlanZ - must be integer
  seed: z.string().optional()
});

workouts.post("/preview", async (req, res) => {
  // If auth is required, wrap with requireAuth; for now keep public to simplify dev
  const parsed = PreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok:false, error:"invalid_request", details:parsed.error.flatten() });
  }

  try {
    const { focus, durationMin, equipment, intensity, seed } = parsed.data;
    const workoutSeed = seed ?? Math.random().toString(16).slice(2).toUpperCase();
    
    // Use the OpenAI-first generator for maximum variety
    const { generateWorkout } = await import('../workoutGenerator');
    
    console.log('[WORKOUTS ROUTER /preview] OpenAI-first generation:', {
      style: focus,
      duration: durationMin,
      equipment: equipment.length,
      seed: workoutSeed
    });
    
    const generatedPlan = await generateWorkout({
      category: focus,
      style: focus,
      goal: focus,
      focus: focus,
      durationMin,
      duration: durationMin,
      intensity,
      equipment,
      seed: workoutSeed
    } as any);
    
    console.log('[WORKOUTS ROUTER /preview] Generated successfully');
    
    return res.json({ ok: true, preview: generatedPlan, seed: workoutSeed });
  } catch (err: any) {
    req.log?.error({ err }, "preview failed");
    
    // If validation error, capture to Sentry and return readable message
    const message = err instanceof Error ? err.message : "Failed to generate valid workout plan";
    
    console.error('[WORKOUTS ROUTER /preview] Generation error:', message);
    
    // TODO: Add Sentry capture when available
    // Sentry.captureException(err);
    
    return res.status(500).json({ 
      ok: false, 
      error: "preview_failed", 
      message: `Workout generation failed: ${message}` 
    });
  }
});

// Back-compat alias - use safer path registration approach
workouts.post("/generate/preview", async (req, res) => {
  // Redirect to the canonical endpoint to avoid handler duplication
  return res.redirect(307, "/api/workouts/preview");
});