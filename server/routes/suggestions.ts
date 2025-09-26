import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { nanoid } from "nanoid";
import * as Sentry from "@sentry/node";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { computeSuggestion } from "../logic/suggestions";
import { generateWithFallback } from "../lib/generator/generate";
import { insertWorkout } from "../dal/workouts";
import { deriveSuggestionSeed } from "../services/suggestionInputs";
import { db } from "../db";
import { suggestedWorkouts, workouts, prs, healthReports } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

/**
 * Register suggestion-related API routes
 */
export function registerSuggestionRoutes(app: Express) {
  
  /**
   * GET /api/suggestions/today
   * 
   * Gets or generates the daily workout suggestion for the authenticated user.
   * Returns clean JSON for all states: unauth, no data, success.
   * Adapted to generator v0.3 + seeds with Sentry logging.
   */
  app.get("/api/suggestions/today", async (req, res) => {
    const requestId = crypto.randomUUID();
    
    try {
      // Set content type to JSON
      res.type('application/json');

      // Check authentication without requiring middleware throwing
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.id) {
        console.log({ requestId }, 'Unauthenticated request to /api/suggestions/today');
        return res.status(200).json({ 
          suggestion: null, 
          reason: "unauthenticated",
          requestId
        });
      }

      const userId = authReq.user.id;
      console.log({ requestId, userId }, 'GET /api/suggestions/today');

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Check if we already have a suggestion for today using Drizzle
      const existingSuggestion = await db
        .select()
        .from(suggestedWorkouts)
        .where(and(
          eq(suggestedWorkouts.userId, userId),
          eq(suggestedWorkouts.date, today)
        ))
        .limit(1);
        
      const suggestion = existingSuggestion[0] || null;

      if (suggestion) {
        console.log(`✅ Returning existing suggestion for ${today}`);
        return res.status(200).json({
          ...suggestion,
          isExisting: true,
          requestId
        });
      }

      // Try to derive suggestion inputs
      let inputs, context, recent;
      try {
        const seedData = await deriveSuggestionSeed(userId);
        inputs = seedData.inputs;
        context = seedData.context;
        recent = seedData.recent;
      } catch (seedError) {
        console.log({ requestId, userId, error: seedError }, 'Cannot derive suggestion inputs');
        return res.status(200).json({
          suggestion: null,
          reason: "insufficient-context",
          requestId
        });
      }

      // Generate new suggestion using v0.3 compatible approach
      console.log(`🧠 Computing new suggestion for ${today}`);
      
      // Create seed for v0.3 generator
      const seed = {
        rngSeed: nanoid(10),
        generatorVersion: 'v0.3.0',
        inputs,
        context,
      };

      // Try to generate preview using current system (fallback to old approach)
      let suggestionResult;
      try {
        // First attempt: generate via v0.3 approach if available
        // For now, fall back to existing computeSuggestion since we don't have v0.3 generator fully implemented
        suggestionResult = await computeSuggestion(userId, new Date());
      } catch (generatorError) {
        console.log({ requestId, userId, error: generatorError }, 'Failed to compute suggestion');
        Sentry.captureException(generatorError, { 
          extra: { requestId, userId },
          tags: { component: 'suggestions' }
        });
        return res.status(500).json({ 
          error: 'internal', 
          requestId 
        });
      }

      // Check if workouts table has gen_seed columns for v0.3 support
      let hasGenColumns = false;
      try {
        const columnCheck = await db.execute(
          sql`SELECT column_name FROM information_schema.columns 
              WHERE table_name='workouts' AND column_name IN ('gen_seed','generator_version')`
        );
        hasGenColumns = (columnCheck.rows?.length ?? 0) >= 2;
      } catch (schemaError) {
        console.log({ requestId }, 'Could not check schema, assuming no gen columns');
        hasGenColumns = false;
      }

      // Store the suggestion in the database using Drizzle
      const insertedSuggestion = await db
        .insert(suggestedWorkouts)
        .values({
          userId: userId,
          date: today,
          request: suggestionResult.request,
          rationale: suggestionResult.rationale,
          workoutId: null // Will be set when user generates the actual workout
        })
        .returning();
        
      if (!insertedSuggestion[0]) {
        console.error({ requestId }, "Error inserting suggestion");
        Sentry.captureMessage("Failed to insert suggestion", {
          extra: { requestId, userId }
        });
        return res.status(500).json({ 
          error: 'internal', 
          requestId 
        });
      }

      console.log(`✅ Generated and stored new suggestion with ID: ${insertedSuggestion[0].id}`);
      
      // Return suggestion with seed info for v0.3 compatibility
      return res.status(200).json({
        ...insertedSuggestion[0],
        customSuggestions: suggestionResult.customSuggestions || [],
        isExisting: false,
        seed: { 
          rngSeed: seed.rngSeed, 
          generatorVersion: seed.generatorVersion 
        },
        hasGenColumns, // For debugging
        requestId
      });

    } catch (error) {
      console.error({ requestId }, "Error in /api/suggestions/today:", error);
      
      // Send to Sentry with context
      Sentry.captureException(error, { 
        extra: { requestId },
        tags: { route: '/api/suggestions/today' }
      });
      
      return res.status(500).json({ 
        error: 'internal', 
        requestId 
      });
    }
  });

  /**
   * POST /api/suggestions/generate
   * 
   * Generates the actual workout from today's suggestion and optionally regenerates the suggestion.
   * Body: { regenerate?: boolean }
   * 
   * If regenerate is true, recomputes the suggestion algorithm first.
   * Then calls the existing workout generator with the suggestion parameters.
   * Updates the suggested_workouts.workout_id when the workout is created.
   * Returns { suggestion, workout }.
   */
  app.post("/api/suggestions/generate", requireAuth, async (req, res) => {
    const requestId = crypto.randomUUID();
    
    try {
      res.type('application/json');
      
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request body
      const bodySchema = z.object({
        regenerate: z.boolean().optional()
      });
      
      const { regenerate = false } = bodySchema.parse(req.body);
      
      console.log({ requestId, userId, regenerate }, 'POST /api/suggestions/generate');

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      let suggestion;
      
      if (regenerate) {
        // Recompute the suggestion using our algorithm
        console.log(`🔄 Regenerating suggestion for ${today}`);
        const suggestionResult = await computeSuggestion(userId, new Date());
        
        // Check if suggestion exists, then update or insert using Drizzle
        const existingSuggestion = await db
          .select()
          .from(suggestedWorkouts)
          .where(and(
            eq(suggestedWorkouts.userId, userId),
            eq(suggestedWorkouts.date, today)
          ))
          .limit(1);
          
        if (existingSuggestion[0]) {
          // Update existing suggestion
          const updated = await db
            .update(suggestedWorkouts)
            .set({
              request: suggestionResult.request,
              rationale: suggestionResult.rationale,
              workoutId: null
            })
            .where(and(
              eq(suggestedWorkouts.userId, userId),
              eq(suggestedWorkouts.date, today)
            ))
            .returning();
            
          suggestion = updated[0];
        } else {
          // Insert new suggestion
          const inserted = await db
            .insert(suggestedWorkouts)
            .values({
              userId: userId,
              date: today,
              request: suggestionResult.request,
              rationale: suggestionResult.rationale,
              workoutId: null
            })
            .returning();
            
          suggestion = inserted[0];
        }
      } else {
        // Get existing suggestion using Drizzle
        const existingSuggestion = await db
          .select()
          .from(suggestedWorkouts)
          .where(and(
            eq(suggestedWorkouts.userId, userId),
            eq(suggestedWorkouts.date, today)
          ))
          .limit(1);
          
        if (!existingSuggestion[0]) {
          return res.status(404).json({ 
            message: "No suggestion found for today. Call /api/suggestions/today first.",
            requestId
          });
        }
        
        suggestion = existingSuggestion[0];
      }

      // Fetch context data for the workout generator using Drizzle
      const [recentWorkouts, recentPRs, latestHealth] = await Promise.all([
        db.select().from(workouts).where(eq(workouts.userId, userId)).orderBy(desc(workouts.createdAt)).limit(14),
        db.select().from(prs).where(eq(prs.userId, userId)).orderBy(desc(prs.date)).limit(5),
        db.select().from(healthReports).where(eq(healthReports.userId, userId)).orderBy(desc(healthReports.date)).limit(1)
      ]);

      // Build enhanced request for the workout generator  
      const requestData = suggestion.request as any;
      const enhancedRequest = {
        category: requestData.category,
        duration: requestData.duration,
        intensity: requestData.intensity,
        recentPRs: recentPRs.map((pr: any) => ({
          exercise: `${pr.movement} (${pr.category})`,
          weight: pr.weightKg ? parseFloat(pr.weightKg.toString()) * 2.20462 : undefined, // Convert kg to lbs
          reps: pr.repMax,
          date: pr.date,
          unit: 'lbs'
        })),
        lastWorkouts: recentWorkouts.slice(0, 3).map((w: any) => ({
          name: w.title,
          category: w.request?.category || requestData.category,
          duration: w.request?.duration || requestData.duration,
          intensity: w.request?.intensity || requestData.intensity,
          date: w.createdAt,
          exercises: [] // Could extract from sets if needed
        })),
        todaysReport: latestHealth[0]?.metrics ? {
          energy: (latestHealth[0].metrics as any)?.recovery?.score ? Math.round((latestHealth[0].metrics as any).recovery.score / 10) : 7,
          stress: (latestHealth[0].metrics as any)?.stress || 5,
          sleep: (latestHealth[0].metrics as any)?.sleepScore ? Math.round((latestHealth[0].metrics as any).sleepScore / 10) : 7,
          soreness: 4 // Would come from user input or wearables
        } : undefined
      };

      // Generate the actual workout using existing AI system
      console.log(`🤖 Generating workout with AI for category: ${requestData.category}`);
      const generatedWorkout = await generateWithFallback(inputs, { request: enhancedRequest });

      // Store the workout in the database
      const workoutData = {
        userId: authReq.user.id,
        workout: {
          title: generatedWorkout.name,
          request: {
            ...enhancedRequest,
            meta: {
              origin: 'suggestion',
              suggestedFor: today,
              version: '2.0',
              rationale: suggestion.rationale
            }
          },
          sets: generatedWorkout.sets || [],
          notes: generatedWorkout.description,
          completed: false
        }
      };

      const dbWorkout = await insertWorkout(workoutData);

      // Update the suggestion to link to the generated workout using Drizzle
      try {
        await db
          .update(suggestedWorkouts)
          .set({ workoutId: dbWorkout.id })
          .where(eq(suggestedWorkouts.id, suggestion.id));
      } catch (updateError) {
        console.error({ requestId }, "Error linking workout to suggestion:", updateError);
        // Don't fail the request, just log the error
      }

      console.log(`✅ Generated workout with ID: ${dbWorkout.id} and linked to suggestion ${suggestion.id}`);

      // Return both suggestion and workout
      return res.status(200).json({
        suggestion: {
          ...suggestion,
          workoutId: dbWorkout.id
        },
        workout: {
          ...generatedWorkout,
          id: dbWorkout.id,
          dbId: dbWorkout.id
        },
        requestId
      });

    } catch (error) {
      console.error({ requestId }, "Error in /api/suggestions/generate:", error);
      
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.issues,
          requestId
        });
      }
      
      // Send to Sentry
      Sentry.captureException(error, { 
        extra: { requestId },
        tags: { route: '/api/suggestions/generate' }
      });
      
      return res.status(500).json({ 
        error: 'internal', 
        requestId 
      });
    }
  });

  /**
   * GET /api/suggestions/debug
   * 
   * Development-only endpoint that returns the raw inputs used by the suggestion algorithm.
   * Useful for testing and debugging the suggestion logic.
   */
  app.get("/api/suggestions/debug", requireAuth, async (req, res) => {
    const requestId = crypto.randomUUID();
    
    try {
      res.type('application/json');
      
      // Only allow in development
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ 
          message: "Debug endpoint not available in production",
          requestId 
        });
      }
      
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      console.log({ requestId, userId }, 'GET /api/suggestions/debug');

      // Import functions from our suggestion engine
      const { fetchWorkoutData, fetchLatestHealthReport } = await import("../logic/suggestions");
      
      const today = new Date();
      
      // Get the same data that computeSuggestion uses
      const workoutData = await fetchWorkoutData(userId, today);
      const latestHealth = await fetchLatestHealthReport(userId);
      
      // Get v0.3 seed data
      const seedData = await deriveSuggestionSeed(userId);
      
      // Return the raw inputs for debugging
      return res.status(200).json({
        userId,
        date: today.toISOString().split('T')[0],
        inputs: {
          workouts: {
            last1Day: workoutData.last1,
            last7Days: workoutData.last7,
            last14Days: workoutData.last14,
            last28Days: workoutData.last28
          },
          health: {
            latest: latestHealth,
            metrics: latestHealth?.metrics || null
          },
          v03Seed: {
            inputs: seedData.inputs,
            context: seedData.context,
            recent: seedData.recent
          }
        },
        summary: {
          totalWorkouts: workoutData.last28.length,
          recentWorkout: workoutData.last28[0] || null,
          hasHealthData: !!latestHealth,
          healthMetricsKeys: latestHealth?.metrics ? Object.keys(latestHealth.metrics as any) : []
        },
        requestId
      });

    } catch (error) {
      console.error({ requestId }, "Error in /api/suggestions/debug:", error);
      
      // Send to Sentry
      Sentry.captureException(error, { 
        extra: { requestId },
        tags: { route: '/api/suggestions/debug' }
      });
      
      return res.status(500).json({ 
        error: 'internal', 
        requestId 
      });
    }
  });
}