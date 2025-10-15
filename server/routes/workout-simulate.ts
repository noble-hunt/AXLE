/**
 * Workout Simulation Route
 * 
 * Handles POST /api/workouts/simulate - Dry-run simulation of workout generation
 * Used for preview generation without persisting to database
 * 
 * HARDENED: Premium-only routing with environment kill switches
 * - AXLE_DISABLE_SIMPLE=1 → Returns 502 if premium fails
 * - HOBH_FORCE_PREMIUM=true → Forces premium path (default)
 * - DEBUG_PREMIUM_STAMP=1 → Adds debug headers
 */

import type { Express } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { simulatePayloadSchema } from "../../shared/types/workouts";
import { generateWorkout } from "../workoutGenerator";

// Environment kill switches
const AXLE_DISABLE_SIMPLE = process.env.AXLE_DISABLE_SIMPLE === '1';
const HOBH_FORCE_PREMIUM = process.env.HOBH_FORCE_PREMIUM === 'true';
const DEBUG_PREMIUM_STAMP = process.env.DEBUG_PREMIUM_STAMP === '1';

export function registerSimulateRoutes(app: Express) {
  /**
   * POST /api/workouts/simulate
   * 
   * Simulate workout generation without persisting to database
   * Used for preview in the workout generator wizard
   */
  app.post("/api/workouts/simulate", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request body using the seeded payload schema
      const validatedData = simulatePayloadSchema.parse(req.body);
      
      // Resolve workout style from archetype field
      const style = String(validatedData.archetype || 'mixed').toLowerCase();
      
      // Build seed string if provided
      let seedString: string | undefined;
      if (validatedData.seed) {
        seedString = `${validatedData.seed.userHash}-${validatedData.seed.day}-${validatedData.seed.focus || style}-${validatedData.seed.nonce || 0}`;
      }
      
      // Log request parameters for debugging
      console.log('[AXLE /simulate]', {
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
      
      // Set debug headers
      if (DEBUG_PREMIUM_STAMP) {
        res.setHeader('X-AXLE-Generator', generator);
        res.setHeader('X-AXLE-Style', actualStyle);
      }
      
      // Check if premium failed and kill switches are enabled
      if ((AXLE_DISABLE_SIMPLE || HOBH_FORCE_PREMIUM) && generator !== 'premium') {
        console.error('[AXLE] Premium generation failed, kill switches prevent fallback');
        return res.status(502).json({
          ok: false,
          error: 'premium_failed',
          detail: `Premium generator not used (got: ${generator}). Kill switches AXLE_DISABLE_SIMPLE=${AXLE_DISABLE_SIMPLE}, HOBH_FORCE_PREMIUM=${HOBH_FORCE_PREMIUM} prevent fallback.`
        });
      }
      
      console.log('[AXLE /simulate] Success:', {
        generator,
        style: actualStyle,
        seed: seedString
      });
      
      // Return workout without database persistence
      res.json({
        ok: true,
        workout: {
          id: null, // No persistence for simulation
          ...generatedWorkout,
          seed: seedString
        },
        meta
      });
    } catch (error: any) {
      console.error('[AXLE /simulate] Error:', error);
      
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
          message: "Failed to simulate workout",
          details: error.message
        }
      });
    }
  });
}
