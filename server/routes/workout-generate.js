/**
 * Workout Generation Route
 *
 * Handles POST /api/workouts/generate - Final workout generation with persistence
 * All generation goes through the orchestrator (generateWorkout)
 */
import { requireAuth } from "../middleware/auth";
import { generatePayloadSchema } from "../../shared/types/workouts";
import { generateWorkout, GENERATOR_STAMP } from "../workoutGenerator";
export function registerGenerateRoutes(app) {
    /**
     * POST /api/workouts/generate
     *
     * Generate and save workout to database
     * Used for final generation in the workout generator wizard
     */
    app.post("/api/workouts/generate", requireAuth, async (req, res, next) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            // Validate request body (now with normalized style)
            const validatedData = generatePayloadSchema.parse(req.body);
            // Build seed string if provided
            let seedString;
            if (validatedData.seed) {
                seedString = `${validatedData.seed.userHash}-${validatedData.seed.day}-${validatedData.seed.focus || validatedData.archetype}-${validatedData.seed.nonce || 0}`;
            }
            // Call the orchestrator (handles all generator selection and fallback logic)
            // Pass through normalized fields from Zod schema (all set to same normalized value)
            const generatedWorkout = await generateWorkout({
                category: validatedData.archetype,
                duration: validatedData.minutes,
                intensity: validatedData.intensity,
                goal: validatedData.goal,
                focus: validatedData.focus,
                style: validatedData.style,
                equipment: validatedData.equipment,
                seed: seedString,
                durationMin: validatedData.minutes
            });
            // Extract metadata
            const meta = generatedWorkout?.meta || {};
            // Set debug headers for easy tracing (always visible in DevTools)
            res.setHeader('X-AXLE-Orchestrator', GENERATOR_STAMP);
            res.setHeader('X-AXLE-Generator', meta.generator || 'unknown');
            res.setHeader('X-AXLE-Style', meta.style || req.body?.style || 'unknown');
            // Save to database
            const { insertWorkout } = await import("../dal/workouts");
            const workoutData = generatedWorkout;
            const workoutParams = {
                userId,
                workout: {
                    title: workoutData.name || meta.title || "Generated Workout",
                    request: validatedData,
                    sets: workoutData.sets || workoutData.blocks || [],
                    notes: `${validatedData.archetype} workout for ${validatedData.minutes} minutes`,
                    completed: false,
                    // Telemetry fields
                    genSeed: validatedData.seed,
                    generatorVersion: 'v0.3.0',
                    generationId: meta.generation_id,
                    rationale: meta.rationale,
                    criticScore: meta.critic_score,
                    rawWorkoutJson: generatedWorkout
                }
            };
            const savedWorkout = await insertWorkout(workoutParams);
            if (!savedWorkout) {
                throw new Error('Failed to save workout to database');
            }
            console.log('[AXLE /generate] Success:', {
                workoutId: savedWorkout.id,
                generator: meta.generator,
                style: meta.style,
                seed: seedString
            });
            return res.json({
                ok: true,
                workout: {
                    id: savedWorkout.id,
                    ...generatedWorkout,
                    seed: seedString
                },
                meta
            });
        }
        catch (e) {
            return next(e);
        }
    });
}
