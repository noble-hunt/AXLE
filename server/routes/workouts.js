import { Router } from "express";
import { z } from "zod";
import { adaptToPlanV1 } from "../workouts/adapter.js";
export const workouts = Router();
// Helper function to transform sets to blocks (Wodify-style)
function transformSetsToBlocks(sets, durationMin) {
    console.log('[TRANSFORM] Input sets headers:', sets.filter((s) => s.is_header).map((s) => ({
        exercise: s.exercise,
        workoutTitle: s.workoutTitle,
        scoreType: s.scoreType,
        coachingCues: s.coachingCues
    })));
    const blocks = [];
    let currentBlock = null;
    for (const set of sets) {
        if (set.is_header) {
            // Save previous block if exists
            if (currentBlock && currentBlock.items.length > 0) {
                blocks.push(currentBlock);
            }
            // Determine block key based on section
            const exerciseLower = set.exercise.toLowerCase();
            let blockKey = 'main';
            if (exerciseLower.includes('warm')) {
                blockKey = 'warmup';
            }
            else if (exerciseLower.includes('cool')) {
                blockKey = 'cooldown';
            }
            // Start new block with Wodify-style fields
            currentBlock = {
                key: blockKey,
                title: set.exercise,
                targetSeconds: set.duration || 300,
                items: [],
                // Wodify-style enhancements (only for main section)
                workoutTitle: set.workoutTitle || undefined,
                scoreType: set.scoreType || undefined,
                coachingCues: set.coachingCues || undefined,
                scalingNotes: set.scalingNotes || undefined,
            };
        }
        else if (currentBlock) {
            // Add item to current block
            const prescription = {
                type: (set.distance_m || set.distance) ? 'distance' : (set.calories) ? 'distance' : (set.duration) ? 'time' : (set.reps) ? 'reps' : 'reps',
                sets: set.num_sets || 1,
                restSec: set.rest_s || 0
            };
            // Handle distance (meters) - accept both distance_m and distance fields
            // Map to 'meters' field that adapter expects
            if (set.distance_m || set.distance) {
                prescription.meters = set.distance_m || set.distance;
            }
            // Handle calories (alternative to meters for cardio)
            else if (set.calories) {
                prescription.calories = set.calories;
            }
            // Handle duration (time-based)
            else if (set.duration) {
                prescription.seconds = set.duration;
            }
            // Handle reps (rep-based)
            else if (set.reps) {
                prescription.reps = set.reps;
            }
            currentBlock.items.push({
                movementId: set.id,
                name: set.exercise,
                prescription,
                notes: set.notes
            });
        }
    }
    // Add last block
    if (currentBlock && currentBlock.items.length > 0) {
        blocks.push(currentBlock);
    }
    // If no blocks created, create minimal structure
    if (blocks.length === 0) {
        blocks.push({
            key: 'main',
            title: 'Main Workout',
            targetSeconds: durationMin * 60,
            items: sets.filter(s => !s.is_header).map(set => ({
                movementId: set.id,
                name: set.exercise,
                prescription: {
                    type: set.reps ? 'reps' : 'time',
                    sets: set.num_sets || 1,
                    reps: set.reps,
                    seconds: set.duration,
                    restSec: set.rest_s || 0
                }
            }))
        });
    }
    return blocks;
}
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
        return res.status(400).json({ ok: false, error: "invalid_request", details: parsed.error.flatten() });
    }
    try {
        const { focus, durationMin, equipment, intensity, seed } = parsed.data;
        const workoutSeed = seed ?? Math.random().toString(16).slice(2).toUpperCase();
        // Use the OpenAI-first generator for maximum variety
        const { generateWorkout } = await import('../workoutGenerator.js');
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
        });
        console.log('[WORKOUTS ROUTER /preview] Generated successfully');
        // Transform GeneratedWorkout (sets) to WorkoutPlan (blocks)
        const transformedPlan = {
            seed: workoutSeed,
            focus: focus,
            durationMin,
            intensity,
            equipment,
            blocks: transformSetsToBlocks(generatedPlan.sets, durationMin),
            totalSeconds: durationMin * 60,
            summary: generatedPlan.description || `${focus} workout`,
            version: 1,
        };
        // Use adapter to ensure valid WorkoutPlan
        const validatedPlan = adaptToPlanV1(transformedPlan);
        // DEBUG: Log Wodify fields in blocks
        console.log('[PREVIEW DEBUG] Blocks with Wodify fields:', validatedPlan.blocks.map((b) => ({
            key: b.key,
            title: b.title,
            workoutTitle: b.workoutTitle,
            scoreType: b.scoreType,
            coachingCues: b.coachingCues
        })));
        return res.json({ ok: true, preview: validatedPlan, seed: workoutSeed });
    }
    catch (err) {
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
        }
        else if (message.includes('API key') || message.includes('not configured')) {
            userMessage = 'OpenAI API configuration error. Please check your API key.';
        }
        else if (message.includes('rate limit')) {
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
