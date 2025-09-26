/**
 * Workout Generation Route
 * 
 * Handles POST /api/workouts/generate - Final workout generation with persistence
 */

import type { Express } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { generatePayloadSchema } from "../../shared/types/workouts";
import { SeededRandom, createSeedString } from "../utils/seeded-random";

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
      
      let seededRng: SeededRandom | undefined;
      let seedUsed: string | undefined;
      
      // If seed is provided, create seeded random generator
      if (validatedData.seed) {
        const seedString = createSeedString(
          validatedData.seed.userHash,
          validatedData.seed.day,
          validatedData.seed.focus,
          validatedData.seed.nonce
        );
        seededRng = new SeededRandom(seedString);
        seedUsed = seedString;
      }
      
      // Generate the workout
      const generatedWorkout = generateMockWorkout(validatedData, seededRng);
      
      // Save to database
      const { insertWorkout } = await import("../dal/workouts");
      const workoutToInsert = {
        userId,
        name: generatedWorkout.meta?.title || "Generated Workout",
        description: `${validatedData.archetype} workout for ${validatedData.minutes} minutes`,
        exercises: JSON.stringify(generatedWorkout.blocks || []),
        totalMinutes: generatedWorkout.estTimeMin || validatedData.minutes,
        estimatedIntensity: generatedWorkout.intensity || validatedData.intensity,
        request: validatedData,
        genSeed: validatedData.seed || null
      };
      
      const savedWorkout = await insertWorkout(workoutToInsert);
      
      res.json({
        ok: true,
        workout: {
          id: savedWorkout.id,
          ...generatedWorkout,
          seed: seedUsed
        }
      });
    } catch (error: any) {
      console.error('Workout generation failed:', error);
      
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

/**
 * Generate a mock workout for generation purposes
 * This demonstrates deterministic generation using seeded random
 */
function generateMockWorkout(payload: any, seededRng?: SeededRandom) {
  const { archetype, minutes, intensity, equipment } = payload;
  
  // Example exercises based on archetype and equipment
  const exercisePool = {
    strength: [
      'Barbell Squat', 'Deadlift', 'Bench Press', 'Pull-ups', 'Overhead Press',
      'Bent-over Row', 'Dips', 'Bulgarian Split Squats'
    ],
    conditioning: [
      'Burpees', 'Mountain Climbers', 'Jump Squats', 'High Knees', 'Sprints',
      'Battle Ropes', 'Box Jumps', 'Kettlebell Swings'
    ],
    mixed: [
      'Thrusters', 'Clean and Press', 'Rowing Intervals', 'Circuit Training',
      'Functional Movements', 'Complex Training'
    ],
    endurance: [
      'Long Run', 'Cycling', 'Swimming', 'Rowing', 'Elliptical',
      'Zone 2 Training', 'Steady State Cardio'
    ]
  };
  
  const availableExercises = exercisePool[archetype as keyof typeof exercisePool] || exercisePool.mixed;
  
  // Use seeded random if available, otherwise use Math.random
  const rng = seededRng || { 
    choice: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)],
    nextInt: (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min
  };
  
  // Generate exercises based on duration
  const numExercises = Math.max(3, Math.min(8, Math.floor(minutes / 5)));
  const selectedExercises = [];
  
  for (let i = 0; i < numExercises; i++) {
    const exercise = rng.choice(availableExercises);
    const sets = rng.nextInt(2, intensity > 7 ? 6 : 4);
    const reps = archetype === 'strength' ? rng.nextInt(3, 8) : rng.nextInt(8, 15);
    
    selectedExercises.push({
      name: exercise,
      sets,
      reps: reps.toString(),
      notes: `Intensity level ${intensity}`
    });
  }
  
  return {
    meta: {
      title: `${archetype.charAt(0).toUpperCase() + archetype.slice(1)} Workout`
    },
    estTimeMin: minutes,
    intensity,
    blocks: selectedExercises
  };
}