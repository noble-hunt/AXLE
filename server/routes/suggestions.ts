import type { Express } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { computeSuggestion } from "../logic/suggestions";
import { generateWorkout } from "../workoutGenerator";
import { insertWorkout } from "../dal/workouts";

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

      // Import supabaseAdmin dynamically
      const { supabaseAdmin } = await import("../lib/supabaseAdmin");
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Check if we already have a suggestion for today
      const { data: existingSuggestion, error: fetchError } = await supabaseAdmin
        .from('suggested_workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();
        
      if (fetchError) {
        console.error("Error fetching existing suggestion:", fetchError);
        return res.status(500).json({ message: "Failed to fetch suggestion" });
      }

      if (existingSuggestion) {
        console.log(`✅ Returning existing suggestion for ${today}`);
        return res.json({
          ...existingSuggestion,
          isExisting: true
        });
      }

      // Generate new suggestion using our sophisticated algorithm
      console.log(`🧠 Computing new suggestion for ${today}`);
      
      const suggestionResult = await computeSuggestion(userId, new Date());
      
      // Store the suggestion in the database
      const { data: insertedSuggestion, error: insertError } = await supabaseAdmin
        .from('suggested_workouts')
        .insert({
          user_id: userId,
          date: today,
          request: suggestionResult.request,
          rationale: suggestionResult.rationale,
          workout_id: null // Will be set when user generates the actual workout
        })
        .select()
        .single();
        
      if (insertError) {
        console.error("Error inserting suggestion:", insertError);
        return res.status(500).json({ message: "Failed to save suggestion" });
      }

      console.log(`✅ Generated and stored new suggestion with ID: ${insertedSuggestion.id}`);
      
      res.json({
        ...insertedSuggestion,
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

      // Import supabaseAdmin dynamically
      const { supabaseAdmin } = await import("../lib/supabaseAdmin");
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      let suggestion;
      
      if (regenerate) {
        // Recompute the suggestion using our algorithm
        console.log(`🔄 Regenerating suggestion for ${today}`);
        const suggestionResult = await computeSuggestion(userId, new Date());
        
        // Update existing suggestion or create new one
        const { data: updatedSuggestion, error: upsertError } = await supabaseAdmin
          .from('suggested_workouts')
          .upsert({
            user_id: userId,
            date: today,
            request: suggestionResult.request,
            rationale: suggestionResult.rationale,
            workout_id: null
          }, {
            onConflict: 'user_id,date'
          })
          .select()
          .single();
          
        if (upsertError) {
          console.error("Error updating suggestion:", upsertError);
          return res.status(500).json({ message: "Failed to regenerate suggestion" });
        }
        
        suggestion = updatedSuggestion;
      } else {
        // Get existing suggestion
        const { data: existingSuggestion, error: fetchError } = await supabaseAdmin
          .from('suggested_workouts')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();
          
        if (fetchError) {
          console.error("Error fetching suggestion:", fetchError);
          return res.status(500).json({ message: "Failed to fetch suggestion" });
        }
        
        if (!existingSuggestion) {
          return res.status(404).json({ message: "No suggestion found for today. Call /api/suggestions/today first." });
        }
        
        suggestion = existingSuggestion;
      }

      // Fetch context data for the workout generator
      const [workoutsResult, prsResult, healthResult] = await Promise.all([
        supabaseAdmin.from('workouts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(14),
        supabaseAdmin.from('prs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5),
        supabaseAdmin.from('health_reports').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1)
      ]);

      // Build enhanced request for the workout generator  
      const enhancedRequest = {
        category: suggestion.request.category,
        duration: suggestion.request.duration,
        intensity: suggestion.request.intensity,
        recentPRs: prsResult.data?.map((pr: any) => ({
          exercise: `${pr.movement} (${pr.category})`,
          weight: pr.weight_kg ? parseFloat(pr.weight_kg.toString()) * 2.20462 : undefined, // Convert kg to lbs
          reps: pr.rep_max,
          date: pr.date,
          unit: 'lbs'
        })) || [],
        lastWorkouts: workoutsResult.data?.slice(0, 3).map((w: any) => ({
          name: w.title,
          category: w.request?.category || suggestion.request.category,
          duration: w.request?.duration || suggestion.request.duration,
          intensity: w.request?.intensity || suggestion.request.intensity,
          date: w.created_at,
          exercises: [] // Could extract from sets if needed
        })) || [],
        todaysReport: healthResult.data?.[0]?.metrics ? {
          energy: (healthResult.data[0].metrics as any)?.recovery?.score ? Math.round((healthResult.data[0].metrics as any).recovery.score / 10) : 7,
          stress: (healthResult.data[0].metrics as any)?.stress || 5,
          sleep: (healthResult.data[0].metrics as any)?.sleepScore ? Math.round((healthResult.data[0].metrics as any).sleepScore / 10) : 7,
          soreness: 4 // Would come from user input or wearables
        } : undefined
      };

      // Generate the actual workout using existing AI system
      console.log(`🤖 Generating workout with AI for category: ${suggestion.request.category}`);
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

      // Update the suggestion to link to the generated workout
      const { error: updateError } = await supabaseAdmin
        .from('suggested_workouts')
        .update({ workout_id: dbWorkout.id })
        .eq('id', suggestion.id);
        
      if (updateError) {
        console.error("Error linking workout to suggestion:", updateError);
        // Don't fail the request, just log the error
      }

      console.log(`✅ Generated workout with ID: ${dbWorkout.id} and linked to suggestion ${suggestion.id}`);

      // Return both suggestion and workout
      res.json({
        suggestion: {
          ...suggestion,
          workout_id: dbWorkout.id
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