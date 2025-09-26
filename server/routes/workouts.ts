import { Router } from "express";
import { z } from "zod";
import { WorkoutPlanZ } from "../../shared/workoutSchema";
import { adaptToPlanV1 } from "../workouts/adapter";
export const workouts = Router();

const PreviewSchema = z.object({
  focus: z.enum(["strength","conditioning","mixed","endurance"]),
  durationMin: z.number().int().min(5).max(180),
  equipment: z.array(z.string()).default([]),
  intensity: z.number().min(1).max(10),
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
    const workoutSeed = seed ?? crypto.randomUUID();
    
    // Generate a proper WorkoutPlan that matches the new schema
    const warmupMin = Math.max(5, Math.round(durationMin/6));
    const mainMin = Math.round(durationMin*0.7);
    const cooldownMin = Math.max(3, Math.round(durationMin/10));
    
    const rawWorkoutPlan = {
      seed: workoutSeed,
      focus,
      durationMin,
      intensity,
      equipment,
      blocks: [
        {
          key: "warmup",
          title: `${focus} warmup`,
          targetSeconds: warmupMin * 60,
          items: [
            {
              movementId: "warmup_movement",
              name: "Dynamic warmup",
              prescription: {
                type: "time" as const,
                sets: 1,
                seconds: warmupMin * 60,
                restSec: 0,
                notes: `${focus} preparation`
              }
            }
          ]
        },
        {
          key: "main",
          title: "Main workout",
          targetSeconds: mainMin * 60,
          items: [
            {
              movementId: "main_movement",
              name: `${focus} training`,
              prescription: {
                type: "time" as const,
                sets: 1,
                seconds: mainMin * 60,
                restSec: 0,
                notes: `intensity ${intensity}/10`,
                load: equipment.length > 0 ? equipment.join(", ") : "bodyweight"
              }
            }
          ]
        },
        {
          key: "cooldown",
          title: "Cool down",
          targetSeconds: cooldownMin * 60,
          items: [
            {
              movementId: "cooldown_movement",
              name: "Recovery",
              prescription: {
                type: "time" as const,
                sets: 1,
                seconds: cooldownMin * 60,
                restSec: 0,
                notes: "breathing / mobility"
              }
            }
          ]
        }
      ],
      totalSeconds: durationMin * 60,
      summary: `${durationMin}-minute ${focus} workout at intensity ${intensity}/10`,
      version: 1 as const
    };

    // Use adapter and validate before responding - fail fast if invalid
    const validatedPlan = adaptToPlanV1(rawWorkoutPlan);
    
    // Double-check with strict validation
    const finalPlan = WorkoutPlanZ.parse(validatedPlan);
    
    return res.json({ ok: true, preview: finalPlan, seed: finalPlan.seed });
  } catch (err: any) {
    req.log?.error({ err }, "preview failed");
    
    // If validation error, capture to Sentry and return readable message
    const message = err instanceof Error ? err.message : "Failed to generate valid workout plan";
    
    // TODO: Add Sentry capture when available
    // Sentry.captureException(err);
    
    return res.status(500).json({ 
      ok: false, 
      error: "preview_failed", 
      message: `Workout generation failed: ${message}` 
    });
  }
});

// Back-compat aliases so any old callers still work
workouts.post("/generate/preview", (req,res,next) => {
  (workouts as any).handle({ ...req, url: "/preview" }, res, next);
});