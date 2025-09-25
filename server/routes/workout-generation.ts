/**
 * AI Workout Generation Routes
 * 
 * Handles /api/generate/crossfit and /api/generate/olympic endpoints
 * 
 * V2 GENERATOR CONTRACT:
 * Future stable interface will accept WorkoutRequest and return WorkoutPlan
 * - POST /api/generate/v2 - WorkoutRequest -> WorkoutPlan
 * - Unified endpoint supporting all workout types through focus parameter
 * - ML policy integration when workouts.v2.useMLPolicy flag is enabled
 * - Backward compatibility maintained for existing v1 endpoints
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
// V2 Generator Types and Configuration
import type { WorkoutRequest, WorkoutPlan } from "../workouts/types";
import { isWorkoutV2Enabled, useMLPolicy } from "../config/flags";

// Request schema for workout generation
const generateWorkoutSchema = z.object({
  duration: z.number().min(5).max(120),
  intensity: z.number().min(1).max(10),
  equipment: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional()
});

/**
 * Compose user context for workout generation
 */
async function composeUserContext(userId: string): Promise<WorkoutGenerationRequest['context']> {
  try {
    // Get user's recent workout history
    const { listWorkouts } = await import("../dal/workouts");
    const recentWorkouts = await listWorkouts(userId, { limit: 7 });
    
    // Get latest health report
    const { listReports } = await import("../dal/reports");
    const healthReports = await listReports(userId, { days: 1 });
    const latestHealth = healthReports[0];
    
    // Find yesterday's workout
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const yesterdayWorkout = recentWorkouts.find(w => 
      w.createdAt && w.createdAt.toISOString().split('T')[0] === yesterdayStr
    );
    
    // Count weekly categories
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyWorkouts = recentWorkouts.filter(w => 
      w.createdAt && w.createdAt >= weekAgo
    );
    
    const weeklyCounts: Record<string, number> = {};
    weeklyWorkouts.forEach(w => {
      if (w.request && typeof w.request === 'object' && 'category' in w.request) {
        const category = (w.request as any).category;
        weeklyCounts[category] = (weeklyCounts[category] || 0) + 1;
      }
    });
    
    return {
      yesterday: yesterdayWorkout ? {
        category: (yesterdayWorkout.request as any)?.category || 'Unknown',
        intensity: (yesterdayWorkout.request as any)?.intensity || 5,
        type: 'workout'
      } : undefined,
      health_snapshot: latestHealth ? {
        hrv: (latestHealth.metrics as any)?.hrv || null,
        resting_hr: (latestHealth.metrics as any)?.restingHeartRate || null,
        sleep_score: (latestHealth.metrics as any)?.sleepScore || null,
        stress_flag: ((latestHealth.metrics as any)?.stress || 0) > 7
      } : undefined,
      equipment: ['barbell', 'kettlebell', 'pull_up_bar', 'box', 'floor'], // Default equipment
      constraints: [],
      goals: ['general_fitness']
    };
  } catch (error) {
    console.warn('Failed to compose user context:', error);
    return {
      equipment: ['barbell', 'kettlebell', 'pull_up_bar', 'box', 'floor'],
      constraints: [],
      goals: ['general_fitness']
    };
  }
}

/**
 * Generate and persist workout with critic scoring
 */
async function generateAndPersistWorkout(
  userId: string,
  category: 'CrossFit/HIIT' | 'Olympic',
  request: WorkoutGenerationRequest
) {
  // Generate workout
  const generator = category === 'CrossFit/HIIT' ? generateCrossFitWorkout : generateOlympicWorkout;
  const workout = await generator(request);
  
  // Add title if not present
  if (!workout.name || workout.name === 'CrossFit Workout' || workout.name === 'Olympic Training') {
    workout.name = generateWorkoutTitle(workout, category);
  }
  
  // Critique and repair
  const critique = await critiqueAndRepair(workout, {
    request,
    originalWorkout: workout
  });
  
  // Render workout for display
  const renderedWorkout = render(critique.workout);
  
  // Persist to database
  const { insertWorkout } = await import("../dal/workouts");
  const savedWorkout = await insertWorkout({
    userId,
    workout: {
      title: critique.workout.name,
      request: request as any,
      sets: critique.workout.blocks.map(block => ({
        id: `block-${Math.random().toString(36).substr(2, 9)}`,
        exercise: block.name || `${block.type} block`,
        notes: ''
      })) as any,
      notes: critique.workout.coaching_notes || '',
      completed: false
    }
  });
  
  return {
    workout: savedWorkout,
    rendered: renderedWorkout,
    score: critique.score,
    issues: critique.issues,
    wasPatched: critique.wasPatched
  };
}

/**
 * Register workout generation routes
 */
export function registerWorkoutGenerationRoutes(app: Express) {
  // CrossFit workout generation
  app.post("/api/generate/crossfit", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request
      const validatedData = generateWorkoutSchema.parse(req.body);
      
      // Compose user context
      const context = await composeUserContext(userId);
      
      // Build generation request
      const request: WorkoutGenerationRequest = {
        category: 'CrossFit/HIIT',
        duration: validatedData.duration,
        intensity: validatedData.intensity,
        context: context ? {
          ...context,
          equipment: validatedData.equipment || context.equipment || ['barbell'],
          constraints: validatedData.constraints || context.constraints || [],
          goals: validatedData.goals || context.goals || ['general_fitness']
        } : {
          equipment: validatedData.equipment || ['barbell'],
          constraints: validatedData.constraints || [],
          goals: validatedData.goals || ['general_fitness']
        }
      };
      
      // Generate and persist workout
      const result = await generateAndPersistWorkout(userId, 'CrossFit/HIIT', request);
      
      res.json({
        id: result.workout.id,
        title: result.workout.title,
        rendered: result.rendered,
        score: result.score,
        issues: result.issues,
        wasPatched: result.wasPatched,
        duration: validatedData.duration,
        intensity: validatedData.intensity
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.issues 
        });
      }
      
      console.error("CrossFit generation failed:", error);
      res.status(500).json({ 
        message: "Failed to generate CrossFit workout",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Olympic workout generation
  app.post("/api/generate/olympic", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request
      const validatedData = generateWorkoutSchema.parse(req.body);
      
      // Compose user context
      const context = await composeUserContext(userId);
      
      // Build generation request
      const request: WorkoutGenerationRequest = {
        category: 'Olympic',
        duration: validatedData.duration,
        intensity: validatedData.intensity,
        context: context ? {
          ...context,
          equipment: validatedData.equipment || context.equipment || ['barbell'],
          constraints: validatedData.constraints || context.constraints || [],
          goals: validatedData.goals || context.goals || ['general_fitness']
        } : {
          equipment: validatedData.equipment || ['barbell'],
          constraints: validatedData.constraints || [],
          goals: validatedData.goals || ['general_fitness']
        }
      };
      
      // Generate and persist workout
      const result = await generateAndPersistWorkout(userId, 'Olympic', request);
      
      res.json({
        id: result.workout.id,
        title: result.workout.title,
        rendered: result.rendered,
        score: result.score,
        issues: result.issues,
        wasPatched: result.wasPatched,
        duration: validatedData.duration,
        intensity: validatedData.intensity
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.issues 
        });
      }
      
      console.error("Olympic generation failed:", error);
      res.status(500).json({ 
        message: "Failed to generate Olympic workout",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}