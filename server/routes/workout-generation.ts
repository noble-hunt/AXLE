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
import type { WorkoutRequest, WorkoutPlan, MetricsSnapshot } from "../workouts/types";
import { isWorkoutV2Enabled, useMLPolicy, shouldShowMetricsDebug } from "../config/flags";
import { generateWorkoutPlan } from "../workouts/engine";
// Telemetry for RL training data collection
import { logGenerationEvent, extractMetricsSnapshot, createRequestHash } from "../workouts/telemetry.js";
import { randomUUID } from "crypto";

// Metrics snapshot schema for validation
const metricsSnapshotSchema = z.object({
  vitality: z.number().min(0).max(100).optional(),
  performancePotential: z.number().min(0).max(100).optional(),
  circadianAlignment: z.number().min(0).max(100).optional(),
  energySystemsBalance: z.number().min(0).max(100).optional(),
  fatigueScore: z.number().min(0).max(100).optional(),
  hrv: z.number().min(0).optional(),
  rhr: z.number().min(30).max(200).optional(),
  sleepScore: z.number().min(0).max(100).optional()
}).optional();

// Request schema for workout generation
const generateWorkoutSchema = z.object({
  duration: z.number().min(5).max(120),
  intensity: z.number().min(1).max(10),
  equipment: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  metricsSnapshot: metricsSnapshotSchema
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
    
    // Extract health modifiers for v0.3 generator
    let healthModifiers = undefined;
    if (latestHealth?.metrics) {
      const metrics = latestHealth.metrics as any;
      const axleScores = metrics.axle || {};
      
      healthModifiers = {
        axleScore: axleScores.axle_score || undefined,
        vitality: axleScores.vitality_score || undefined,
        performancePotential: axleScores.performance_potential || undefined,
        circadian: axleScores.circadian || undefined
      };
    }

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
      goals: ['general_fitness'],
      healthModifiers // New format for v0.3 generator
    };
  } catch (error) {
    console.warn('Failed to compose user context:', error);
    return {
      equipment: ['barbell', 'kettlebell', 'pull_up_bar', 'box', 'floor'],
      constraints: [],
      goals: ['general_fitness'],
      healthModifiers: undefined
    };
  }
}

/**
 * Generate and persist workout using new deterministic generator
 */
async function generateAndPersistWorkout(
  userId: string,
  category: 'CrossFit/HIIT' | 'Olympic',
  request: WorkoutGenerationRequest
) {
  // Import new generator
  const { generateWithFallback } = await import("../lib/generator/generate");
  const { generateWorkoutSeed, convertLegacyRequestToInputs } = await import("../utils/seed-generator");
  const { render } = await import("../ai/generateWorkout");
  
  // Convert request to GeneratorInputs format
  const inputs = convertLegacyRequestToInputs(request);
  
  // Get user context
  const context = await composeUserContext(userId);
  
  // Generate seed for deterministic reproduction
  const seed = generateWorkoutSeed(inputs, userId);
  
  // Get user's workout history for progression
  const { listWorkouts } = await import("../dal/workouts");
  const recentWorkouts = await listWorkouts(userId, { days: 28 });
  
  try {
    // Generate workout using new fallback system
    const result = await generateWithFallback(
      inputs,
      { 
        context: { ...context, dateISO: new Date().toISOString(), userId },
        seed: seed.rngSeed,
        recentWorkouts
      }
    );
    
    // Render workout for display
    const renderedWorkout = render(result.workout);
    
    // Persist to database with seed data
    const { db } = await import("../db");
    const { workouts } = await import("../../shared/schema");
    const [savedWorkout] = await db.insert(workouts).values({
      userId,
      title: result.workout.name,
      request: request as any,
      sets: result.workout.blocks?.map(block => ({
        id: `block-${Math.random().toString(36).substr(2, 9)}`,
        exercise: block.name || `${block.type} block`,
        notes: block.notes || ''
      })) as any || [],
      notes: result.workout.coaching_notes || '',
      completed: false,
      genSeed: { ...seed, choices: result.choices },
      generatorVersion: result.meta?.usedVersion || 'v0.3.0'
    }).returning();
    
    return {
      workout: savedWorkout,
      rendered: renderedWorkout,
      score: 85, // Default score for new generator
      issues: [],
      wasPatched: false,
      seed: { ...seed, choices: result.choices }
    };
    
  } catch (error) {
    console.warn('New generator failed, falling back to legacy system:', error);
    
    // Fallback to legacy system
    const { generateCrossFitWorkout } = await import("../ai/generators/crossfit");
    const { generateOlympicWorkout } = await import("../ai/generators/olympic");
    const { generateWorkoutTitle } = await import("../ai/title");
    const { critiqueAndRepair } = await import("../ai/critic");
    
    const generator = category === 'CrossFit/HIIT' ? generateCrossFitWorkout : generateOlympicWorkout;
    const workout = await generator(request);
    
    if (!workout.name || workout.name === 'CrossFit Workout' || workout.name === 'Olympic Training') {
      workout.name = generateWorkoutTitle(workout, category);
    }
    
    const critique = await critiqueAndRepair(workout, {
      request,
      originalWorkout: workout
    });
    
    const renderedWorkout = render(critique.workout);
    
    const { db } = await import("../db");
    const { workouts } = await import("../../shared/schema");
    const [savedWorkout] = await db.insert(workouts).values({
      userId,
      title: critique.workout.name,
      request: request as any,
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
    
    return {
      workout: savedWorkout,
      rendered: renderedWorkout,
      score: critique.score,
      issues: critique.issues,
      wasPatched: critique.wasPatched,
      seed: seed
    };
  }
}

/**
 * Hydrate metrics from latest health report if not provided in request
 */
async function hydrateMetricsFromHealthReport(userId: string, requestMetrics?: any) {
  try {
    // Get latest health report if metrics not provided
    if (requestMetrics) {
      return requestMetrics; // Use provided metrics
    }

    const { listReports } = await import("../dal/reports");
    const reports = await listReports(userId, { days: 1 });
    const latestReport = reports[0];
    
    if (!latestReport?.metrics) {
      console.warn(`No health report found for user ${userId}, using defaults`);
      return null;
    }

    const metrics = latestReport.metrics as any;
    const axleScores = metrics.axle || {};
    const providerMetrics = metrics.provider || {};

    return {
      vitality: axleScores.vitality_score || 65,
      performancePotential: axleScores.performance_potential || 70,
      circadianAlignment: axleScores.circadian_alignment || 75,
      energySystemsBalance: axleScores.energy_systems_balance || 70,
      sleepScore: providerMetrics.sleep_score || 70,
      hrv: providerMetrics.hrv,
      rhr: providerMetrics.resting_hr,
      fatigueScore: providerMetrics.fatigue_score || 30,
    };
  } catch (error) {
    console.warn('Failed to hydrate metrics from health report:', error);
    return null;
  }
}

/**
 * Get energy systems distribution from last 7 days of health reports
 */
async function getEnergySystemsHistory(userId: string) {
  try {
    const { listReports } = await import("../dal/reports");
    const reports = await listReports(userId, { days: 7 });
    
    const energySystems = {
      alactic: 0,
      phosphocreatine: 0,
      glycolytic: 0,
      aerobicZ1: 0,
      aerobicZ2: 0,
      aerobicZ3: 0
    };

    reports.forEach(report => {
      const metrics = report.metrics as any;
      if (metrics?.energy?.systems) {
        Object.entries(metrics.energy.systems).forEach(([system, count]) => {
          if (system in energySystems) {
            energySystems[system as keyof typeof energySystems] += (count as number) || 0;
          }
        });
      }
    });

    return energySystems;
  } catch (error) {
    console.warn('Failed to get energy systems history:', error);
    return null;
  }
}

/**
 * Apply circadian alignment adjustments to workout request
 */
function applyCircadianAdjustments(request: any, circadianAlignment: number) {
  const currentHour = new Date().getHours();
  const isEarlyMorning = currentHour >= 5 && currentHour <= 8;
  
  if (circadianAlignment < 50 && isEarlyMorning) {
    // Reduce high-intensity intervals, extend warmup
    request.circadianAdjustments = {
      shortenHIIT: true,
      extendWarmup: true,
      reason: `Low circadian alignment (${circadianAlignment}) in early AM`
    };
  }
  
  return request;
}

/**
 * Convert user context to biometrics and history for V2 engine
 */
async function convertToV2Format(userId: string, context: any, request: any) {
  let metrics: any;
  let metricsSource = 'defaults';
  
  // Check if metricsSnapshot is provided in request (takes priority)
  if (request.metricsSnapshot) {
    metrics = {
      vitality: request.metricsSnapshot.vitality || 65,
      performancePotential: request.metricsSnapshot.performancePotential || 70,
      circadianAlignment: request.metricsSnapshot.circadianAlignment || 75,
      energySystemsBalance: request.metricsSnapshot.energySystemsBalance || 70,
      sleepScore: request.metricsSnapshot.sleepScore || 70,
      hrv: request.metricsSnapshot.hrv,
      rhr: request.metricsSnapshot.rhr,
      fatigueScore: request.metricsSnapshot.fatigueScore || 30
    };
    metricsSource = 'request_provided';
  } else {
    // Try to hydrate from health reports if no metricsSnapshot provided
    const hydratedMetrics = await hydrateMetricsFromHealthReport(userId, null);
    
    if (hydratedMetrics) {
      metrics = hydratedMetrics;
      metricsSource = 'health_report';
    } else {
      // Use defaults as last resort
      metrics = {
        vitality: 65,
        performancePotential: 70,
        circadianAlignment: 75,
        energySystemsBalance: 70,
        sleepScore: context?.health_snapshot?.sleep_score || 70,
        hrv: context?.health_snapshot?.hrv,
        rhr: context?.health_snapshot?.resting_hr,
        fatigueScore: 30
      };
      metricsSource = 'defaults';
    }
  }

  // Get energy systems history for balancing
  const energySystemsHistory = await getEnergySystemsHistory(userId);
  
  // Build biometrics for engine
  const biometrics = {
    performancePotential: metrics.performancePotential,
    vitality: metrics.vitality,
    sleepScore: metrics.sleepScore,
    hrv: metrics.hrv,
    restingHR: metrics.rhr
  };

  // Build history from yesterday's workout if available
  const history = context?.yesterday ? [{
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    primaryPattern: 'squat' as const, // Simplified mapping
    energySystems: ['glycolytic' as const],
    estimatedTSS: context.yesterday.intensity * 10,
    intensityRating: context.yesterday.intensity
  }] : [];

  // Apply circadian adjustments
  const adjustedRequest = applyCircadianAdjustments({ ...request }, metrics.circadianAlignment);

  // Build V2 WorkoutRequest
  const workoutRequest: WorkoutRequest = {
    date: new Date().toISOString(),
    userId: userId,
    goal: 'general_fitness',
    availableMinutes: adjustedRequest.duration || 45,
    equipment: context?.equipment || ['barbell', 'kettlebell'],
    experienceLevel: 'intermediate' as const,
    injuries: context?.constraints || [],
    preferredDays: [],
    recentHistory: [],
    metricsSnapshot: {
      vitality: metrics.vitality,
      performancePotential: metrics.performancePotential,
      circadianAlignment: metrics.circadianAlignment,
      fatigueScore: metrics.fatigueScore,
      hrv: metrics.hrv,
      rhr: metrics.rhr,
      sleepScore: metrics.sleepScore
    },
    intensityFeedback: []
  };

  return { 
    workoutRequest, 
    biometrics, 
    history,
    debugInfo: {
      metricsSource,
      axleScores: {
        vitality: metrics.vitality,
        performancePotential: metrics.performancePotential,
        circadianAlignment: metrics.circadianAlignment,
        energySystemsBalance: metrics.energySystemsBalance
      },
      energySystemsHistory,
      circadianAdjustments: adjustedRequest.circadianAdjustments
    }
  };
}

/**
 * Register workout generation routes
 */
export function registerWorkoutGenerationRoutes(app: Express) {
  // V2 Unified Workout Generation Endpoint
  app.post("/api/generate/v2", requireAuth, async (req, res) => {
    const startTime = Date.now();
    const generationId = randomUUID();
    
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Check if V2 is enabled
      if (!isWorkoutV2Enabled()) {
        return res.status(403).json({ 
          message: "V2 workout generation is not enabled" 
        });
      }
      
      // Validate request
      const validatedData = generateWorkoutSchema.parse(req.body);
      
      // Compose user context (reuse existing function)
      const context = await composeUserContext(userId);
      
      // Convert to V2 format
      const { workoutRequest, biometrics, history, debugInfo } = await convertToV2Format(userId, context, validatedData);
      
      // Generate workout using V2 engine
      const workoutPlan = generateWorkoutPlan(
        workoutRequest,
        history,
        [], // No progression states yet - could be loaded from database
        biometrics,
        debugInfo.energySystemsHistory || undefined
      );
      
      // Calculate response time for telemetry
      const responseTimeMs = Date.now() - startTime;
      
      // Log telemetry for RL training data collection
      try {
        const metricsSnapshot = extractMetricsSnapshot(debugInfo.axleScores);
        const generationEventData = {
          selectedFocus: workoutPlan.focus,
          targetIntensity: workoutPlan.targetIntensity,
          blockIds: workoutPlan.blocks.map(block => block.id),
          estimatedTSS: workoutPlan.estimatedTSS || 0,
          metricsSnapshot,
          workoutRequest: {
            category: 'CrossFit', // Default category for V2
            duration: validatedData.duration,
            intensity: validatedData.intensity,
            equipment: validatedData.equipment || []
          },
          v2Request: validatedData // Store full V2 request for analysis
        };
        
        await logGenerationEvent(userId, generationEventData, responseTimeMs, generationId);
      } catch (telemetryError) {
        // Don't fail the request if telemetry fails
        console.error('❌ [TELEMETRY] Failed to log generation event:', telemetryError);
      }
      
      // For development, log the generation process
      console.log('🏋️ V2 Workout Generated:', {
        generationId,
        focus: workoutPlan.focus,
        intensity: workoutPlan.targetIntensity,
        blocks: workoutPlan.blocks.length,
        estimatedTSS: workoutPlan.estimatedTSS,
        metricsSource: debugInfo.metricsSource,
        responseTimeMs
      });
      
      const response: any = {
        success: true,
        plan: workoutPlan,
        generationId, // Include generation ID for feedback linking
        generatedAt: new Date().toISOString(),
        version: 'v2'
      };

      // Add debug info if flag is enabled
      if (shouldShowMetricsDebug()) {
        response.debug = debugInfo;
      }

      res.json(response);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.issues 
        });
      }
      
      console.error("V2 generation failed:", error);
      res.status(500).json({ 
        message: "Failed to generate V2 workout",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Development testing endpoint for V2 metrics (bypasses auth)
  if (process.env.NODE_ENV !== 'production') {
    app.post("/api/dev/generate/v2", async (req, res) => {
      try {
        // Validate request
        const validatedData = generateWorkoutSchema.parse(req.body);
        
        // Use a test user ID
        const userId = 'test-user-123';
        
        // Convert to V2 format with provided metrics
        const { workoutRequest, biometrics, history, debugInfo } = await convertToV2Format(userId, {}, validatedData);
        
        // Generate workout using V2 engine
        const workoutPlan = generateWorkoutPlan(
          workoutRequest,
          history,
          [], // No progression states
          biometrics,
          debugInfo.energySystemsHistory || undefined
        );
        
        console.log('🧪 DEV V2 Workout Generated:', {
          focus: workoutPlan.focus,
          intensity: workoutPlan.targetIntensity,
          blocks: workoutPlan.blocks.length,
          metricsSource: debugInfo.metricsSource
        });
        
        const response: any = {
          success: true,
          plan: workoutPlan,
          generatedAt: new Date().toISOString(),
          version: 'v2-dev',
          debug: debugInfo
        };

        res.json(response);
        
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            message: "Invalid request data", 
            errors: error.issues 
          });
        }
        
        console.error("DEV V2 generation failed:", error);
        res.status(500).json({ 
          message: "Failed to generate DEV V2 workout",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });
  }

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
        intensity: validatedData.intensity,
        seed: result.seed
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
        intensity: validatedData.intensity,
        seed: result.seed
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