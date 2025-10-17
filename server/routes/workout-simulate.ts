/**
 * Workout Simulation Route
 * 
 * Handles POST /api/workouts/simulate - Dry-run simulation of workout generation
 * Used for preview generation without persisting to database
 * All generation goes through the orchestrator (generateWorkout)
 */

import type { Express } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { normalizeStyleMiddleware } from "../middleware/normalizeStyle";
import { simulatePayloadSchema } from "../../shared/types/workouts";
import { generateWorkout, GENERATOR_STAMP } from "../workoutGenerator";

export function registerSimulateRoutes(app: Express) {
  /**
   * POST /api/workouts/simulate
   * 
   * Simulate workout generation without persisting to database
   * Used for preview in the workout generator wizard
   */
  app.post("/api/workouts/simulate", requireAuth, normalizeStyleMiddleware, async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request body (now with normalized style)
      const validatedData = simulatePayloadSchema.parse(req.body);
      
      // Build seed string if provided
      let seedString: string | undefined;
      if (validatedData.seed) {
        seedString = `${validatedData.seed.userHash}-${validatedData.seed.day}-${validatedData.seed.focus || validatedData.archetype}-${validatedData.seed.nonce || 0}`;
      }
      
      // Call the orchestrator (handles all generator selection and fallback logic)
      const generatedWorkout = await generateWorkout({
        category: validatedData.archetype,
        duration: validatedData.minutes,
        intensity: validatedData.intensity,
        goal: validatedData.archetype,
        focus: validatedData.archetype,
        style: validatedData.archetype,
        equipment: validatedData.equipment,
        seed: seedString,
        durationMin: validatedData.minutes
      } as any);
      
      // Extract metadata
      const meta = (generatedWorkout as any)?.meta || {};
      
      // Set debug headers for easy tracing (always visible in DevTools)
      res.setHeader('X-AXLE-Orchestrator', GENERATOR_STAMP);
      res.setHeader('X-AXLE-Generator', meta.generator || 'unknown');
      res.setHeader('X-AXLE-Style', meta.style || req.body?.style || 'unknown');
      
      console.log('[AXLE /simulate] Success:', {
        generator: meta.generator,
        style: meta.style,
        seed: seedString
      });
      
      // Return workout without database persistence
      return res.json({
        ok: true,
        workout: {
          id: null, // No persistence for simulation
          ...generatedWorkout,
          seed: seedString
        },
        meta
      });
    } catch (e) {
      return next(e);
    }
  });
}
