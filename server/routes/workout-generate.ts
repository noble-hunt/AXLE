/**
 * Workout Generation Route
 * 
 * Handles POST /api/workouts/generate - Final workout generation with persistence
 * 
 * HARDENED: Premium-only routing with environment kill switches
 * - AXLE_DISABLE_SIMPLE=1 → Returns 502 if premium fails
 * - HOBH_FORCE_PREMIUM=true → Forces premium path (default)
 * - DEBUG_PREMIUM_STAMP=1 → Adds debug headers
 */

import type { Express } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { generatePayloadSchema } from "../../shared/types/workouts";
import { generateWorkout, GENERATOR_STAMP } from "../workoutGenerator";

// Environment kill switches
const AXLE_DISABLE_SIMPLE = process.env.AXLE_DISABLE_SIMPLE === '1';
const HOBH_FORCE_PREMIUM = process.env.HOBH_FORCE_PREMIUM === 'true';
const DEBUG_PREMIUM_STAMP = process.env.DEBUG_PREMIUM_STAMP === '1';

export function registerGenerateRoutes(app: Express) {
  /**
   * POST /api/workouts/generate
   * 
   * Generate and save workout to database
   * Used for final generation in the workout generator wizard
   */
  app.post("/api/workouts/generate", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request body using the seeded payload schema
      const validatedData = generatePayloadSchema.parse(req.body);
      
      // Resolve workout style from archetype field
      const style = String(validatedData.archetype || 'mixed').toLowerCase();
      
      // Build seed string if provided
      let seedString: string | undefined;
      if (validatedData.seed) {
        seedString = `${validatedData.seed.userHash}-${validatedData.seed.day}-${validatedData.seed.focus || style}-${validatedData.seed.nonce || 0}`;
      }
      
      // Log request parameters for debugging
      console.log('[AXLE /generate]', {
        userId,
        style,
        archetype: validatedData.archetype,
        duration: validatedData.minutes,
        intensity: validatedData.intensity,
        equipment: validatedData.equipment,
        seed: seedString,
        killSwitches: {
          AXLE_DISABLE_SIMPLE,
          HOBH_FORCE_PREMIUM
        }
      });
      
      // Call the orchestrator (premium-first with fallback chain)
      const generatedWorkout = await generateWorkout({
        category: style,
        duration: validatedData.minutes,
        intensity: validatedData.intensity,
        goal: validatedData.archetype,
        focus: validatedData.archetype,
        style: style,
        equipment: validatedData.equipment,
        seed: seedString,
        durationMin: validatedData.minutes
      } as any);
      
      // Extract metadata for headers (handle different response structures)
      const meta = (generatedWorkout as any)?.meta || {};
      const generator = meta.generator || 'unknown';
      const actualStyle = meta.style || style;
      
      // Set debug headers (always visible in DevTools)
      res.setHeader('X-AXLE-Generator', (generatedWorkout as any)?.meta?.generator || 'unknown');
      res.setHeader('X-AXLE-Style', (generatedWorkout as any)?.meta?.style || req.body?.goal || 'unknown');
      res.setHeader('X-AXLE-Orchestrator', GENERATOR_STAMP);
      
      // Check if premium failed and kill switches are enabled
      if ((AXLE_DISABLE_SIMPLE || HOBH_FORCE_PREMIUM) && generator !== 'premium') {
        console.error('[AXLE] Premium generation failed, kill switches prevent fallback');
        return res.status(502).json({
          ok: false,
          error: 'premium_failed',
          detail: `Premium generator not used (got: ${generator}). Kill switches AXLE_DISABLE_SIMPLE=${AXLE_DISABLE_SIMPLE}, HOBH_FORCE_PREMIUM=${HOBH_FORCE_PREMIUM} prevent fallback.`
        });
      }
      
      // Save to database
      const { insertWorkout } = await import("../dal/workouts");
      const workoutData = generatedWorkout as any;
      const workoutParams = {
        userId,
        workout: {
          title: workoutData.name || meta.title || "Generated Workout",
          request: validatedData,
          sets: workoutData.sets || workoutData.blocks || [],
          notes: `${style} workout for ${validatedData.minutes} minutes`,
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
        generator,
        style: actualStyle,
        seed: seedString
      });
      
      res.json({
        ok: true,
        workout: {
          id: savedWorkout.id,
          ...generatedWorkout,
          seed: seedString
        },
        meta
      });
    } catch (error: any) {
      console.error('[AXLE /generate] Error:', error);
      
      // If kill switches are enabled, return 502 for any premium failure
      if (AXLE_DISABLE_SIMPLE || HOBH_FORCE_PREMIUM) {
        return res.status(502).json({
          ok: false,
          error: 'premium_failed',
          detail: String(error?.message || error)
        });
      }
      
      // Legacy error handling (only when kill switches disabled)
      if (error.name === 'ZodError') {
        return res.status(400).json({
          ok: false,
          error: {
            message: "Invalid request data",
            details: error.errors
          }
        });
      }
      
      res.status(500).json({
        ok: false,
        error: {
          message: "Failed to generate workout",
          details: error.message
        }
      });
    }
  });
}
