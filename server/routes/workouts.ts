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
    
    // Extract meaningful error message
    const message = err instanceof Error ? err.message : "Failed to generate valid workout plan";
    const errorCode = err?.code || 'UNKNOWN_ERROR';
    const errorStatus = err?.status || 500;
    
    console.error('[WORKOUTS ROUTER /preview] Generation error:', {
      message,
      code: errorCode,
      status: errorStatus,
      stack: err?.stack?.split('\n').slice(0, 3).join('\n')
    });
    
    // TODO: Add Sentry capture when available
    // Sentry.captureException(err);
    
    // Return user-friendly error message
    let userMessage = message;
    if (message.includes('timed out')) {
      userMessage = 'Workout generation took too long. Please try again with simpler settings.';
    } else if (message.includes('API key') || message.includes('not configured')) {
      userMessage = 'OpenAI API configuration error. Please check your API key.';
    } else if (message.includes('rate limit')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    }
    
    return res.status(500).json({ 
      ok: false, 
      error: "preview_failed", 
      message: userMessage,
      details: message
    });
  }
});

// Back-compat alias - use safer path registration approach
workouts.post("/generate/preview", async (req, res) => {
  // Redirect to the canonical endpoint to avoid handler duplication
  return res.redirect(307, "/api/workouts/preview");
});