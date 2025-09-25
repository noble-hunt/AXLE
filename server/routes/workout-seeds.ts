/**
 * Workout Seed Management Routes
 * 
 * Handles regeneration and simulation of workouts from seeds:
 * - POST /api/workouts/regenerate - Regenerate workout from existing seed
 * - POST /api/workouts/simulate - Dry-run simulation of workout generation
 */

import type { Express } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";
import { generateCrossFitWorkout } from "../ai/generators/crossfit";
import { generateOlympicWorkout } from "../ai/generators/olympic";
import { critiqueAndRepair } from "../ai/critic";
import { generateWorkoutTitle } from "../ai/title";
import { render } from "../../client/src/ai/render";
import type { WorkoutGenerationRequest } from "../ai/generateWorkout";
import type { GeneratorSeed } from "../../shared/generator-types";
import { generatorSeedSchema } from "../../shared/generator-types";
import { generateWorkoutSeed, convertLegacyRequestToInputs, createSeededRandom } from "../utils/seed-generator";

// Schema for regenerate endpoint
const regenerateSchema = z.object({
  workoutId: z.string().uuid().optional(),
  seed: generatorSeedSchema.optional(),
}).refine(data => data.workoutId || data.seed, {
  message: "Either workoutId or seed must be provided"
});

// Schema for simulate endpoint
const simulateSchema = z.object({
  inputs: z.object({
    archetype: z.enum(['strength', 'conditioning', 'mixed', 'endurance']),
    minutes: z.number().min(5).max(120),
    targetIntensity: z.union([
      z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
      z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10)
    ]),
    equipment: z.array(z.string()),
    constraints: z.array(z.string()).optional(),
    location: z.enum(['home', 'gym', 'outside']).optional(),
  }),
  rngSeed: z.string(),
  generatorVersion: z.string(),
});

/**
 * Register seed management routes
 */
export function registerSeedRoutes(app: Express) {
  
  /**
   * POST /api/workouts/regenerate
   * 
   * Regenerate a workout using the same seed from an existing workout or provided seed
   */
  app.post("/api/workouts/regenerate", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request body
      const validatedData = regenerateSchema.parse(req.body);
      const preview = req.query.preview === 'true';
      
      let seed: GeneratorSeed;
      
      if (validatedData.workoutId) {
        // Fetch seed from existing workout
        const { getWorkout } = await import("../dal/workouts");
        const workout = await getWorkout(userId, validatedData.workoutId);
        
        if (!workout) {
          return res.status(404).json({ error: "Workout not found" });
        }
        
        if (workout.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        if (!workout.genSeed || typeof workout.genSeed !== 'object') {
          return res.status(400).json({ 
            error: "Workout does not have a valid generation seed",
            details: "This workout was created before seed tracking was implemented"
          });
        }
        
        seed = workout.genSeed as GeneratorSeed;
      } else if (validatedData.seed) {
        seed = validatedData.seed;
      } else {
        return res.status(400).json({ error: "Either workoutId or seed must be provided" });
      }
      
      // Convert inputs to legacy format for existing generators
      const legacyRequest: WorkoutGenerationRequest = {
        category: seed.inputs.archetype === 'strength' ? 'Strength' : 
                 seed.inputs.archetype === 'conditioning' ? 'CrossFit' :
                 seed.inputs.archetype === 'endurance' ? 'Cardio' : 'HIIT' as any,
        duration: seed.inputs.minutes,
        intensity: seed.inputs.targetIntensity,
        context: {
          equipment: seed.inputs.equipment,
          constraints: seed.inputs.constraints || [],
          goals: [seed.inputs.archetype]
        }
      };
      
      // Determine generator based on archetype
      const isOlympic = seed.inputs.equipment.includes('barbell') && 
                       seed.inputs.archetype === 'strength';
      const category = isOlympic ? 'Olympic' : 'CrossFit/HIIT';
      const generator = isOlympic ? generateOlympicWorkout : generateCrossFitWorkout;
      
      // Create seeded random generator for deterministic results
      const seededRng = createSeededRandom(seed.rngSeed);
      
      // Generate workout using the seed
      const workout = await generator(legacyRequest);
      
      // Add title if not present
      if (!workout.name || workout.name === 'CrossFit Workout' || workout.name === 'Olympic Training') {
        workout.name = generateWorkoutTitle(workout, category);
      }
      
      if (preview) {
        // Return just the generated workout without persisting
        const renderedWorkout = render(workout);
        return res.json({
          workout: renderedWorkout,
          seed: seed,
          preview: true
        });
      }
      
      // Critique and repair
      const critique = await critiqueAndRepair(workout, {
        request: legacyRequest,
        originalWorkout: workout
      });
      
      // Render workout for display
      const renderedWorkout = render(critique.workout);
      
      // Persist to database with same seed - using direct database insert to include genSeed
      const { db } = await import("../db");
      const { workouts } = await import("../../shared/schema");
      const [savedWorkout] = await db.insert(workouts).values({
        userId,
        title: critique.workout.name,
        request: legacyRequest as any,
        sets: critique.workout.blocks.map(block => ({
          id: `block-${Math.random().toString(36).substr(2, 9)}`,
          exercise: block.name || `${block.type} block`,
          notes: ''
        })) as any,
        notes: critique.workout.coaching_notes || '',
        completed: false,
        genSeed: seed,
        generatorVersion: seed.generatorVersion
      }).returning();
      
      res.json({
        workout: savedWorkout,
        rendered: renderedWorkout,
        score: critique.score,
        issues: critique.issues,
        wasPatched: critique.wasPatched,
        seed: seed
      });
      
    } catch (error) {
      console.error("Error in regenerate endpoint:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request format",
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "Failed to regenerate workout",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  /**
   * POST /api/workouts/simulate
   * 
   * Simulate workout generation without persisting to database
   */
  app.post("/api/workouts/simulate", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request body
      const validatedData = simulateSchema.parse(req.body);
      
      // Create seed object
      const seed: GeneratorSeed = {
        rngSeed: validatedData.rngSeed,
        generatorVersion: validatedData.generatorVersion,
        inputs: validatedData.inputs,
        context: {
          dateISO: new Date().toISOString(),
          userId: userId
        }
      };
      
      // Convert inputs to legacy format for existing generators
      const legacyRequest: WorkoutGenerationRequest = {
        category: seed.inputs.archetype === 'strength' ? 'Strength' : 
                 seed.inputs.archetype === 'conditioning' ? 'CrossFit' :
                 seed.inputs.archetype === 'endurance' ? 'Cardio' : 'HIIT' as any,
        duration: seed.inputs.minutes,
        intensity: seed.inputs.targetIntensity,
        context: {
          equipment: seed.inputs.equipment,
          constraints: seed.inputs.constraints || [],
          goals: [seed.inputs.archetype]
        }
      };
      
      // Determine generator based on archetype
      const isOlympic = seed.inputs.equipment.includes('barbell') && 
                       seed.inputs.archetype === 'strength';
      const category = isOlympic ? 'Olympic' : 'CrossFit/HIIT';
      const generator = isOlympic ? generateOlympicWorkout : generateCrossFitWorkout;
      
      // Create seeded random generator for deterministic results
      const seededRng = createSeededRandom(seed.rngSeed);
      
      // Generate workout using the seed
      const workout = await generator(legacyRequest);
      
      // Add title if not present
      if (!workout.name || workout.name === 'CrossFit Workout' || workout.name === 'Olympic Training') {
        workout.name = generateWorkoutTitle(workout, category);
      }
      
      // Render workout for display (no critique for simulation)
      const renderedWorkout = render(workout);
      
      res.json({
        workout: renderedWorkout,
        seed: seed,
        simulation: true
      });
      
    } catch (error) {
      console.error("Error in simulate endpoint:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request format",
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "Failed to simulate workout",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}