import type { Express } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { computeSuggestion } from "../logic/suggestions";
import { generateWorkout } from "../workoutGenerator";
import { insertWorkout } from "../dal/workouts";
import { db } from "../db";
import { suggestedWorkouts, workouts, prs, healthReports } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Register suggestion-related API routes
 */
export function registerSuggestionRoutes(app: Express) {
  
  /**
   * GET /api/suggestions/today
   * 
   * Gets or generates the daily workout suggestion for the authenticated user.
   * If a suggestion already exists for today, returns it.
   * If not, computes a new suggestion, stores it, and returns it.
   */
  app.get("/api/suggestions/today", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      console.log(`🎯 Getting daily suggestion for user: ${userId}`);

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
        return res.json({
          ...suggestion,
          isExisting: true
        });
      }

      // Generate new suggestion using our sophisticated algorithm
      console.log(`🧠 Computing new suggestion for ${today}`);
      
      const suggestionResult = await computeSuggestion(userId, new Date());
      
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
        console.error("Error inserting suggestion");
        return res.status(500).json({ message: "Failed to save suggestion" });
      }

      console.log(`✅ Generated and stored new suggestion with ID: ${insertedSuggestion[0].id}`);
      
      res.json({
        ...insertedSuggestion[0],
        customSuggestions: suggestionResult.customSuggestions || [],
        isExisting: false
      });

    } catch (error) {
      console.error("Error in /api/suggestions/today:", error);
      
      // Handle UUID validation errors specifically
      if (error instanceof Error && error.message.includes('Invalid userId format')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ 
        message: "Failed to get daily suggestion",
        error: "An internal error occurred while getting your daily suggestion."
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
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Validate request body
      const bodySchema = z.object({
        regenerate: z.boolean().optional()
      });
      
      const { regenerate = false } = bodySchema.parse(req.body);
      
      console.log(`🎯 Generating workout from suggestion for user: ${userId}, regenerate: ${regenerate}`);

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
          return res.status(404).json({ message: "No suggestion found for today. Call /api/suggestions/today first." });
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
      const generatedWorkout = await generateWorkout(enhancedRequest);

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
        console.error("Error linking workout to suggestion:", updateError);
        // Don't fail the request, just log the error
      }

      console.log(`✅ Generated workout with ID: ${dbWorkout.id} and linked to suggestion ${suggestion.id}`);

      // Return both suggestion and workout
      res.json({
        suggestion: {
          ...suggestion,
          workoutId: dbWorkout.id
        },
        workout: {
          ...generatedWorkout,
          id: dbWorkout.id,
          dbId: dbWorkout.id
        }
      });

    } catch (error) {
      console.error("Error in /api/suggestions/generate:", error);
      
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.issues 
        });
      }
      
      // Handle UUID validation errors
      if (error instanceof Error && error.message.includes('Invalid userId format')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ 
        message: "Failed to generate workout from suggestion",
        error: "An internal error occurred while generating your workout."
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
    try {
      // Only allow in development
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Debug endpoint not available in production" });
      }
      
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      console.log(`🔍 Debug suggestion inputs for user: ${userId}`);

      // Import functions from our suggestion engine
      const { fetchWorkoutData, fetchLatestHealthReport } = await import("../logic/suggestions");
      
      const today = new Date();
      
      // Get the same data that computeSuggestion uses
      const workoutData = await fetchWorkoutData(userId, today);
      const latestHealth = await fetchLatestHealthReport(userId);
      
      // Return the raw inputs for debugging
      res.json({
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
          }
        },
        summary: {
          totalWorkouts: workoutData.last28.length,
          recentWorkout: workoutData.last28[0] || null,
          hasHealthData: !!latestHealth,
          healthMetricsKeys: latestHealth?.metrics ? Object.keys(latestHealth.metrics as any) : []
        }
      });

    } catch (error) {
      console.error("Error in /api/suggestions/debug:", error);
      
      // Handle UUID validation errors
      if (error instanceof Error && error.message.includes('Invalid userId format')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ 
        message: "Failed to get debug information",
        error: "An internal error occurred while fetching debug data."
      });
    }
  });
}