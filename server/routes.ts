import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ENV_DEBUG } from './config/env';
import { 
  insertWorkoutSchema, 
  insertPRSchema, 
  insertAchievementSchema,
  insertWorkoutFeedbackSchema
} from "@shared/schema";
import { generateWorkout } from "./workoutGenerator";
import { workoutRequestSchema, WorkoutRequest } from "../shared/schema";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "./middleware/auth";
import { listWorkouts, getWorkout, insertWorkout, updateWorkout, deleteWorkout, startWorkoutAtomic, getRecentRPE, getZoneMinutes14d, getStrain } from "./dal/workouts";
import { listPRs } from "./dal/prs";
import { list as listAchievements } from "./dal/achievements";
import { listReports } from "./dal/reports";
import { listWearables } from "./dal/wearables";
import { registerSuggestionRoutes } from "./routes/suggestions";
import { getTodaySuggestionsCount, getLastRunAt, generateDailySuggestions } from "./jobs/suggestions-cron";
import workoutFreeformRouter from "./routes/workout-freeform";
import whisperRouter from "./routes/whisper-transcription";
import { registerGroupRoutes } from "./routes/groups";
import { registerWorkoutGenerationRoutes } from "./routes/workout-generation";
import { registerSeedRoutes } from "./routes/workout-seeds";
import { registerSimulateRoutes } from "./routes/workout-simulate";
import { registerGenerateRoutes } from "./routes/workout-generate";
import { startSuggestedWorkout } from "./routes/workouts.start";
import { registerWorkoutSuggestionRoutes } from "./routes/workout-suggest";
import { initializeBlockLibrary, getBlocks } from "./workouts/library/index";
import healthRoutes from "./routes/health";
import healthMetricsRouter from "./routes/health-metrics";
import pushNativeRouter from "./routes/push-native";
import pushRouter from "./routes/push";
import notificationPrefsRouter from "./routes/notification-prefs";
import notificationTopicsRouter from "./routes/notifications-topics";
import cronWeeklyRouter from "./routes/cron-weekly";
import storageRouter from "./routes/storage";
import { router as healthzRouter } from "./routes/healthz";
import { suggest } from "./routes/suggest";
import debugStyleRouter from "./routes/_debug-style";
import debugTraceRouter from "./routes/_debug-trace";
import debugParseRouter from "./routes/_debug-parse";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize workout block library
  initializeBlockLibrary();
  
  // Debug route for style normalization
  app.use(debugStyleRouter);
  
  // Debug route for trace diagnostics
  app.use(debugTraceRouter);
  
  // Debug route for schema parsing
  app.use(debugParseRouter);
  
  // Dev route for testing workout library
  app.get("/api/dev/workouts/library", (req, res) => {
    try {
      const { type, energySystem, movementPattern, experience, maxDuration } = req.query;
      
      const filter: any = {};
      if (type) filter.type = type;
      if (energySystem) filter.energySystem = energySystem;
      if (movementPattern) filter.movementPattern = movementPattern;
      if (experience) filter.experience = experience;
      if (maxDuration) filter.maxDuration = Number(maxDuration);
      
      const blocks = getBlocks(Object.keys(filter).length > 0 ? filter : undefined);
      res.json({ blocks, count: blocks.length });
    } catch (error) {
      console.error("Failed to get workout blocks:", error);
      res.status(500).json({ error: "Failed to get workout blocks" });
    }
  });

  // Dev route for testing V2 workout generation (no auth required)
  app.post("/api/dev/workouts/generate", async (req, res) => {
    // Only available in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }
    
    try {
      const { generateWorkoutPlan } = await import("./workouts/engine");
      
      // Parse request parameters
      const { duration = 45, intensity = 6, equipment = [], vitality = 65, performancePotential = 70 } = req.body;
      
      // Build mock request
      const mockUserId = "dev-user-test";
      const workoutRequest = {
        date: new Date().toISOString(),
        userId: mockUserId,
        goal: 'general_fitness',
        availableMinutes: duration,
        equipment: equipment.length > 0 ? equipment : ['barbell', 'kettlebell'],
        experienceLevel: 'intermediate' as const,
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: vitality,
          performancePotential: performancePotential,
          circadianAlignment: 75,
          fatigueScore: 30,
          sleepScore: 70
        },
        intensityFeedback: []
      };
      
      // Mock biometrics and history
      const biometrics = {
        performancePotential,
        vitality,
        sleepScore: 70
      };
      
      const history: any[] = []; // Empty history for dev testing
      const progressionStates: any[] = []; // No progression tracking for dev
      
      // Generate workout plan
      const workoutPlan = generateWorkoutPlan(
        workoutRequest,
        history,
        progressionStates,
        biometrics
      );
      
      console.log('🏋️ Dev V2 Workout Generated:', {
        focus: workoutPlan.focus,
        intensity: workoutPlan.targetIntensity,
        blocks: workoutPlan.blocks.length,
        estimatedTSS: workoutPlan.estimatedTSS
      });
      
      res.json({
        success: true,
        plan: workoutPlan,
        generatedAt: new Date().toISOString(),
        version: 'v2-dev',
        request: { duration, intensity, equipment, vitality, performancePotential }
      });
      
    } catch (error) {
      console.error("Dev V2 generation failed:", error);
      res.status(500).json({ 
        error: "Failed to generate dev V2 workout",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoint to verify AI configuration and environment flags
  app.get('/api/_debug/ai', (_req, res) => {
    res.json({ ok: true, ...ENV_DEBUG });
  });

  // Dev route for simulating week workout plans
  app.get("/api/dev/workouts/simulate", async (req, res) => {
    // Only available in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }
    
    try {
      const { generateWorkoutPlan } = await import("./workouts/engine");
      
      // Parse query parameters
      const { 
        days = 7, 
        profile = 'intermediate',
        equipment = ''
      } = req.query;

      const numDays = Math.min(parseInt(days as string) || 7, 14); // Cap at 14 days
      const profileLevel = profile as string;
      
      // Parse equipment from comma-separated string
      const availableEquipment = equipment ? 
        (equipment as string).split(',').map(e => e.trim()) : 
        ['dumbbells', 'kettlebells'];

      // Define profile archetypes
      const profiles = {
        newbie: {
          experienceLevel: 'beginner' as const,
          vitality: 60,
          performancePotential: 40,
          avgIntensity: 4,
          maxDuration: 30
        },
        intermediate: {
          experienceLevel: 'intermediate' as const,
          vitality: 75,
          performancePotential: 70,
          avgIntensity: 6,
          maxDuration: 45
        },
        experienced: {
          experienceLevel: 'advanced' as const,
          vitality: 85,
          performancePotential: 90,
          avgIntensity: 8,
          maxDuration: 60
        }
      };

      const currentProfile = profiles[profileLevel as keyof typeof profiles] || profiles.intermediate;

      // Generate workout plans for each day
      const weekPlan = [];
      const workoutHistory: any[] = [];

      for (let day = 0; day < numDays; day++) {
        const dayDate = new Date();
        dayDate.setDate(dayDate.getDate() + day);

        // Add some variability to metrics over the week
        const vitalityVariation = (Math.random() - 0.5) * 20; // ±10 points
        const intensityVariation = Math.random() > 0.7 ? 1 : 0; // Occasionally higher intensity
        
        const workoutRequest = {
          date: dayDate.toISOString(),
          userId: `sim-user-${profileLevel}`,
          goal: 'general fitness',
          availableMinutes: currentProfile.maxDuration - (Math.random() * 15), // Some time variation
          equipment: availableEquipment,
          experienceLevel: currentProfile.experienceLevel,
          injuries: [],
          preferredDays: [],
          recentHistory: [],
          metricsSnapshot: {
            vitality: Math.max(30, Math.min(100, currentProfile.vitality + vitalityVariation)),
            performancePotential: currentProfile.performancePotential,
            circadianAlignment: 70 + (Math.random() * 20), // 70-90
            fatigueScore: 0.2 + (Math.random() * 0.3), // 0.2-0.5
            sleepScore: 60 + (Math.random() * 30) // 60-90
          },
          intensityFeedback: []
        };

        const biometrics = {
          performancePotential: currentProfile.performancePotential,
          vitality: workoutRequest.metricsSnapshot.vitality,
          sleepScore: workoutRequest.metricsSnapshot.sleepScore
        };

        // Generate workout plan
        const workoutPlan = generateWorkoutPlan(
          workoutRequest,
          workoutHistory.slice(-7), // Last 7 workouts for context
          [], // No progression states for simulation
          biometrics
        );

        // Add to history for next iterations
        if (workoutHistory.length >= 7) {
          workoutHistory.shift(); // Remove oldest
        }
        workoutHistory.push({
          date: dayDate.toISOString(),
          primaryPattern: 'squat', // Simplified for simulation
          energySystems: ['phosphocreatine'],
          estimatedTSS: workoutPlan.estimatedTSS,
          intensityRating: currentProfile.avgIntensity + intensityVariation
        });

        weekPlan.push({
          day: day + 1,
          date: dayDate.toISOString().split('T')[0],
          dayOfWeek: dayDate.toLocaleDateString('en-US', { weekday: 'long' }),
          plan: workoutPlan,
          metrics: workoutRequest.metricsSnapshot
        });
      }

      // Calculate summary stats
      const totalTSS = weekPlan.reduce((sum, day) => sum + day.plan.estimatedTSS, 0);
      const avgIntensity = weekPlan.reduce((sum, day) => sum + day.plan.targetIntensity, 0) / weekPlan.length;
      const totalCalories = weekPlan.reduce((sum, day) => sum + day.plan.estimatedCalories, 0);
      
      const focusDistribution = weekPlan.reduce((acc, day) => {
        acc[day.plan.focus] = (acc[day.plan.focus] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`🗓️ Simulated ${numDays}-day plan for ${profileLevel}:`, {
        totalTSS,
        avgIntensity: avgIntensity.toFixed(1),
        focusDistribution
      });

      res.json({
        success: true,
        summary: {
          profile: profileLevel,
          equipment: availableEquipment,
          totalDays: numDays,
          totalTSS,
          avgIntensity: Math.round(avgIntensity * 10) / 10,
          totalCalories,
          focusDistribution
        },
        weekPlan,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error("Week simulation failed:", error);
      res.status(500).json({ 
        error: "Failed to simulate week plan",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  

  // POST /api/workouts/preview - Generate workout preview using new engine (no auth required)
  app.post("/api/workouts/preview", async (req, res) => {
    res.type('application/json');
    
    try {
      const { focus, durationMin, intensity, equipment, seed: providedSeed } = req.body ?? {};
      
      if (!focus || !durationMin || !intensity) {
        return res.status(400).json({ 
          ok: false, 
          error: { code: 'BAD_INPUT', message: 'Missing required fields: focus, durationMin, intensity' } 
        });
      }
      
      // Import new workout generation engine
      const { generateWorkoutPlan } = await import('./workouts/engine');
      const { generateSeed } = await import('./lib/seededRandom');
      
      const equipmentList = equipment || ['bodyweight'];
      const workoutSeed = providedSeed || generateSeed();
      
      // Build WorkoutRequest for the new engine
      const workoutRequest: any = {
        date: new Date().toISOString(),
        userId: 'preview-user', // Preview mode - no user ID
        goal: 'general_fitness',
        availableMinutes: durationMin,
        equipment: equipmentList,
        experienceLevel: 'intermediate' as const,
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: 65,
          performancePotential: 70,
          circadianAlignment: 75,
          fatigueScore: 30,
          hrv: undefined,
          rhr: undefined,
          sleepScore: 70
        },
        intensityFeedback: []
      };
      
      // Generate workout plan using the new deterministic engine
      const workoutPlan = generateWorkoutPlan(
        workoutRequest,
        [], // No history for preview
        [], // No progression states
        {
          performancePotential: 70,
          vitality: 65,
          sleepScore: 70,
          hrv: undefined,
          restingHR: undefined
        },
        undefined // No energy systems history
      );
      
      // Return the WorkoutPlan directly with seed
      res.json({ 
        ok: true, 
        preview: workoutPlan,
        seed: workoutSeed
      });
    } catch (e: any) {
      console.error('[preview] err', e);
      res.status(500).json({ 
        ok: false, 
        error: { code: 'INTERNAL', message: e?.message || 'Preview generation failed' } 
      });
    }
  });

  // Environment guards for forcing premium-only path
  const AXLE_DISABLE_SIMPLE = process.env.AXLE_DISABLE_SIMPLE === '1';
  const AXLE_FORCE_PREMIUM = process.env.HOBH_FORCE_PREMIUM === 'true';

  // POST /api/workouts/generate - Generate workout using orchestrator only
  app.post("/api/workouts/generate", async (req, res) => {
    res.type('application/json');
    
    try {
      const reqBody = req.body || {};
      
      // Normalize goal/style/focus slugs
      const goal = String(reqBody.goal || reqBody.focus || 'crossfit').toLowerCase();
      const { durationMin, intensity, equipment, seed, categories_for_mixed } = reqBody;
      
      if (!durationMin || !intensity) {
        return res.status(400).json({ 
          ok: false, 
          error: { code: 'BAD_INPUT', message: 'Missing required fields: durationMin, intensity' } 
        });
      }
      
      // Ensure premium sees style
      reqBody.style = goal;
      reqBody.goal = goal;
      reqBody.focus = goal;
      reqBody.category = goal;
      reqBody.duration = durationMin;
      reqBody.equipment = equipment || ['bodyweight'];
      reqBody.seed = seed;
      reqBody.categories_for_mixed = categories_for_mixed;
      
      console.log('[AXLE] /api/workouts/generate', {
        goal: reqBody.goal,
        focus: reqBody.focus,
        style: reqBody.style,
        durationMin: reqBody.durationMin,
        intensity: reqBody.intensity,
        equipment: reqBody.equipment,
        seed: reqBody.seed
      });
      
      // Call the orchestrator ONLY (no direct simple/premium calls)
      const workout = await generateWorkout(reqBody) as any;
      
      // Bubble meta for clients + debugging
      const meta = workout?.meta || {};
      res.setHeader('X-AXLE-Generator', meta.generator || 'unknown');
      res.setHeader('X-AXLE-Style', meta.style || goal);
      
      return res.json({ ok: true, workout, meta });
    } catch (err: any) {
      // If premium failed AND fallbacks are disabled, expose the error
      if (AXLE_DISABLE_SIMPLE || AXLE_FORCE_PREMIUM) {
        console.error('[AXLE] premium path failed:', err?.message, err?.stack);
        return res.status(502).json({ 
          ok: false, 
          error: 'premium_failed', 
          detail: String(err?.message || err) 
        });
      }
      // Generic error handler
      console.error('[generate] err', err);
      res.status(500).json({ 
        ok: false, 
        error: { code: 'INTERNAL', message: err?.message || 'Generation failed' } 
      });
    }
  });

  // Register suggestion routes
  registerSuggestionRoutes(app);
  
  // Register workout suggestion routes (JSON-only API endpoints)
  registerWorkoutSuggestionRoutes(app);
  
  // Register seed routes
  registerSeedRoutes(app);
  
  // Register workout start route (materialize suggestion)
  app.post('/api/workouts/start', requireAuth, startSuggestedWorkout);
  
  // Register workout freeform routes
  app.use("/api/workouts", workoutFreeformRouter);
  
  // Register whisper transcription routes  
  app.use("/api/stt", whisperRouter);
  
  // Register health provider routes
  app.use("/api", healthRoutes);
  
  // Register health metrics routes
  app.use("/api/health", healthMetricsRouter);
  
  // Register native push notification routes
  app.use("/api/push", pushNativeRouter);
  
  // Register web push notification routes
  app.use("/api/push", pushRouter);
  
  // Register notification preferences routes
  app.use("/api/notification-prefs", notificationPrefsRouter);
  
  // Register notification topics routes
  app.use(notificationTopicsRouter);
  
  // Register cron weekly routes
  app.use(cronWeeklyRouter);
  
  // Register group routes
  registerGroupRoutes(app);
  
  // Register workout generation routes
  registerWorkoutGenerationRoutes(app);
  
  // Register workout simulation routes
  registerSimulateRoutes(app);
  
  // Register workout generation routes with seeding
  registerGenerateRoutes(app);
  
  // Register storage routes
  app.use("/api/storage", storageRouter);
  
  // Register health check routes
  app.use("/api/healthz", healthzRouter);
  
  // Register suggest routes
  app.use("/api/suggest", suggest);
  
  // Authenticated data fetching routes
  app.get("/api/user/data", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // Fetch all user data in parallel
      const [workouts, prs, achievements, healthReports, wearables] = await Promise.all([
        listWorkouts(userId, { limit: 20 }),
        listPRs(userId),
        listAchievements(userId),
        listReports(userId, { days: 14 }),
        listWearables(userId)
      ]);

      res.json({
        workouts,
        prs,
        achievements,
        healthReports,
        wearables
      });
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  // Profile provider management - GET current profile with providers
  app.get("/api/profiles/providers", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Import the profiles get function
      const { getProfile } = await import("./dal/profiles");
      
      // Get current profile using authenticated user ID
      const profile = await getProfile(authReq.user.id);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.json({ profile });
    } catch (error) {
      console.error("Failed to get profile providers:", error);
      res.status(500).json({ message: "Failed to get providers" });
    }
  });

  // Profile provider management - POST to add a provider
  app.post("/api/profiles/providers", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { provider } = req.body;
      
      // Validate provider against whitelist
      const allowedProviders = ['google'] as const;
      if (!provider || !allowedProviders.includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      // Import the profiles update function
      const { updateProfileProviders } = await import("./dal/profiles");
      
      // Use authenticated user ID from middleware (security fix)
      const updatedProfile = await updateProfileProviders(authReq.user.id, provider);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.json({ message: "Provider linked successfully", profile: updatedProfile });
    } catch (error) {
      console.error("Failed to update profile providers:", error);
      res.status(500).json({ message: "Failed to link provider" });
    }
  });

  // Profile update - PATCH to update profile fields
  const updateProfileSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    username: z.string().optional(),
    dateOfBirth: z.string().optional().nullable(), // ISO date string or null
    avatarUrl: z.string().optional(),
  });

  app.patch("/api/profiles", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const validatedData = updateProfileSchema.parse(req.body);
      
      // Import the profiles update function
      const { updateProfile } = await import("./dal/profiles");
      
      // Update profile with validated data
      const updatedProfile = await updateProfile(authReq.user.id, validatedData);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.json({ message: "Profile updated successfully", profile: updatedProfile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Failed to update profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Profile upsert - POST to create/update profile fields
  const upsertProfileSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    username: z.string().optional(),
    dateOfBirth: z.string().optional().nullable(),
    avatarUrl: z.string().optional(),
  });

  app.post("/api/profiles/upsert", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const validatedData = upsertProfileSchema.parse(req.body);
      
      // Import the profiles functions
      const { updateProfile, getProfile } = await import("./dal/profiles");
      
      // Try to get existing profile first
      let profile = await getProfile(authReq.user.id);
      
      if (!profile) {
        // Profile doesn't exist, create new one by updating with data
        profile = await updateProfile(authReq.user.id, validatedData);
      } else {
        // Profile exists, update it
        profile = await updateProfile(authReq.user.id, validatedData);
      }
      
      res.json({ message: "Profile upserted successfully", profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Failed to upsert profile:", error);
      res.status(500).json({ message: "Failed to upsert profile" });
    }
  });

  // POST /api/workouts - Create a new workout
  app.post("/api/workouts", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const validatedData = insertWorkoutSchema.parse(req.body);
      
      // Create workout data for insertion - map to expected format
      const workoutData = {
        title: validatedData.title,
        request: validatedData.request as Record<string, any>,
        sets: validatedData.sets as Record<string, any>,
        notes: validatedData.notes || undefined,
        completed: validatedData.completed || false,
        feedback: validatedData.feedback as Record<string, any> | undefined
      };
      
      // Insert workout using data access layer
      const workout = await insertWorkout({ userId: authReq.user.id, workout: workoutData });
      
      // Validate that we got a valid UUID back
      const UUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!workout?.id || !UUIDv4.test(workout.id)) {
        console.error('[workouts:create] invalid id returned:', workout?.id);
        return res.status(500).json({ error: 'no_valid_id' });
      }
      
      console.log(`[WORKOUTS] Created workout ${workout.id} for user ${authReq.user.id}`);
      
      // Return only the id as specified
      return res.status(200).json({ id: workout.id });
    } catch (error: any) {
      console.error('[workouts:create] error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'validation_failed', issues: error.issues });
      }
      return res.status(500).json({ error: 'create_failed' });
    }
  });

  // GET /api/me/location - Read current location consent + cache
  app.get("/api/me/location", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const result = await db.execute(sql`
        SELECT last_lat, last_lon, timezone
        FROM profiles 
        WHERE user_id = ${userId}
      `);
      
      const profile = result?.rows?.[0];
      
      res.json({
        optIn: false, // Temporarily disabled until schema is updated
        consentAt: null,
        lat: profile?.last_lat ?? null,
        lon: profile?.last_lon ?? null,
        timezone: profile?.timezone ?? null,
      });
    } catch (error) {
      console.error("Error fetching location consent:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/me/location - Update consent; optionally refresh cached coords + tz
  const locationUpdateSchema = z.object({
    optIn: z.boolean(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    timezone: z.string().optional()
  });

  app.post("/api/me/location", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const validatedData = locationUpdateSchema.parse(req.body);
      
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      let updateSql;
      
      if (validatedData.optIn) {
        if (typeof validatedData.lat === "number" && typeof validatedData.lon === "number") {
          // Quantize coordinates to 3 decimal places for privacy (~110m accuracy)
          const quantizedLat = parseFloat(validatedData.lat.toFixed(3));
          const quantizedLon = parseFloat(validatedData.lon.toFixed(3));
          updateSql = sql`
            UPDATE profiles 
            SET 
              last_lat = ${quantizedLat},
              last_lon = ${quantizedLon}
              ${validatedData.timezone ? sql`, timezone = ${validatedData.timezone}` : sql``}
            WHERE user_id = ${authReq.user.id}
            RETURNING user_id
          `;
        } else if (validatedData.timezone) {
          updateSql = sql`
            UPDATE profiles 
            SET 
              timezone = ${validatedData.timezone}
            WHERE user_id = ${authReq.user.id}
            RETURNING user_id
          `;
        } else {
          // For now, just return success since location_opt_in column doesn't exist
          return res.json({ success: true });
        }
      } else {
        // Clear cached coords on opt-out
        updateSql = sql`
          UPDATE profiles 
          SET 
            last_lat = NULL,
            last_lon = NULL
          WHERE user_id = ${authReq.user.id}
          RETURNING user_id
        `;
      }

      const result = await db.execute(updateSql);

      if (!result || !result.rows || result.rows.length === 0) {
        console.error('[location/update] No rows updated - user may not exist');
        return res.status(500).json({ message: 'Failed to update location consent' });
      }

      console.log(`[LOCATION] Updated location consent for user ${authReq.user.id}: optIn=${validatedData.optIn}`);
      
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('[location/update] error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid location data', issues: error.issues });
      }
      return res.status(500).json({ 
        message: 'Failed to update location', 
        detail: error.message ?? error 
      });
    }
  });

  // PUT /api/profiles - Stable endpoint that bypasses Supabase schema cache
  const putProfileSchema = z.object({
    first_name: z.string().trim().max(80).optional().nullable(),
    last_name: z.string().trim().max(80).optional().nullable(), 
    date_of_birth: z.string().trim().optional().nullable() // 'YYYY-MM-DD' format
  }).strict();

  function toDateOrNull(s?: string | null) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return s; // Postgres accepts YYYY-MM-DD format
  }

  app.put("/api/profiles", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = putProfileSchema.parse(req.body ?? {});

      // Use direct SQL to bypass Supabase schema cache issues
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const updateData = {
        user_id: authReq.user.id,
        first_name: body.first_name ?? null,
        last_name: body.last_name ?? null,
        date_of_birth: toDateOrNull(body.date_of_birth)
      };

      // Upsert using raw SQL to avoid cache issues
      const result = await db.execute(sql`
        INSERT INTO profiles (user_id, first_name, last_name, date_of_birth)
        VALUES (${updateData.user_id}, ${updateData.first_name}, ${updateData.last_name}, ${updateData.date_of_birth})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name, 
          date_of_birth = EXCLUDED.date_of_birth
        RETURNING user_id, first_name, last_name, date_of_birth
      `);

      if (!result || !result.rows || result.rows.length === 0) {
        console.error('[profile/upsert] No result returned from SQL');
        return res.status(500).json({ message: 'Failed to upsert profile', detail: 'No result returned' });
      }

      return res.status(200).json({ profile: result.rows[0] });
    } catch (error: any) {
      // Log full error details
      console.error('[profile/upsert] error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', issues: error.issues });
      }
      return res.status(500).json({ 
        message: 'Failed to upsert profile', 
        detail: error.message ?? error 
      });
    }
  });

  // Workout routes
  app.get("/api/workouts", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const workouts = await listWorkouts(authReq.user.id, { limit: 20 });
      res.json(workouts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workouts" });
    }
  });

  // GET /api/workouts/recent - Get recent workouts for home page
  app.get("/api/workouts/recent", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const workouts = await listWorkouts(authReq.user.id, { limit: 3 });
      res.json(workouts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent workouts" });
    }
  });

  app.get("/api/workouts/:id", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const workout = await getWorkout(authReq.user.id, req.params.id);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      res.json(workout);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workout" });
    }
  });

  app.post("/api/workouts", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Validate request body with local schema that maps client inputs
      const bodySchema = z.object({
        title: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        notes: z.string().optional(),
        sets: z.array(z.any()).optional(),
        exercises: z.array(z.any()).optional()
      });
      
      const body = bodySchema.parse(req.body);
      const title = body.title ?? body.name ?? "Untitled";
      const sets = body.sets ?? body.exercises ?? [];
      
      const workout = await insertWorkout({
        userId: authReq.user.id,
        workout: {
          title,
          request: req.body,
          sets,
          notes: body.notes,
          completed: false
        }
      });
      
      res.json(workout);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid workout data", errors: error.issues });
      }
      console.error("Failed to create workout:", error);
      res.status(500).json({ message: "Failed to create workout" });
    }
  });

  // Start a specific workout by ID
  app.post("/api/workouts/:id/start", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      
      // Atomically start the workout - prevents race conditions
      const result = await startWorkoutAtomic(authReq.user.id, id);
      
      if (!result) {
        return res.status(404).json({ message: "Workout not found" });
      }
      
      if (result.wasAlreadyStarted) {
        // Idempotent response - workout was already started
        return res.status(200).json({ 
          id: result.workout.id, 
          message: "Workout already started",
          started_at: result.workout.started_at
        });
      }
      
      // Successfully started
      res.status(200).json({ 
        id: result.workout.id,
        started_at: result.workout.started_at
      });
    } catch (error) {
      console.error("Failed to start workout:", error);
      res.status(500).json({ message: "Failed to start workout" });
    }
  });

  app.put("/api/workouts/:id", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const patch = req.body;
      const workout = await updateWorkout(authReq.user.id, req.params.id, patch);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      res.json(workout);
    } catch (error) {
      console.error("Failed to update workout:", error);
      res.status(500).json({ message: "Failed to update workout" });
    }
  });

  app.delete("/api/workouts/:id", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      await deleteWorkout(authReq.user.id, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete workout:", error);
      res.status(500).json({ message: "Failed to delete workout" });
    }
  });



  // Personal Records routes
  app.get("/api/personal-records", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const prs = await listPRs(authReq.user.id);
      res.json(prs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch personal records" });
    }
  });

  app.post("/api/personal-records", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Validate request body with Zod schema using camelCase fields
      const validatedData = insertPRSchema.parse({
        movement: req.body.exercise || req.body.movement,
        category: req.body.category || req.body.movementCategory,
        weightKg: req.body.unit === 'LBS' ? req.body.weight / 2.20462 : req.body.weight,
        repMax: req.body.reps || req.body.repMax,
        date: req.body.date
      });
      
      const { insertPR } = await import("./dal/prs");
      const pr = await insertPR({
        userId: authReq.user.id,
        category: validatedData.category,
        movement: validatedData.movement,
        repMax: validatedData.repMax as 1 | 3 | 5 | 10,
        weightKg: Number(validatedData.weightKg),
        date: validatedData.date ? new Date(validatedData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
      
      res.json(pr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid PR data", errors: error.issues });
      }
      console.error("Failed to create PR:", error);
      res.status(500).json({ message: "Failed to create personal record" });
    }
  });

  app.delete("/api/personal-records/:id", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { deletePR } = await import("./dal/prs");
      const success = await deletePR(authReq.user.id, req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Personal record not found" });
      }
      res.json({ message: "Personal record deleted successfully" });
    } catch (error) {
      console.error("Failed to delete PR:", error);
      res.status(500).json({ message: "Failed to delete personal record" });
    }
  });

  // Achievements routes
  app.get("/api/achievements", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const achievements = await listAchievements(authReq.user.id);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.put("/api/achievements/batch", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { achievements } = req.body;
      
      // Validate achievements array with Zod schema
      const achievementBatchSchema = z.object({
        achievements: z.array(z.object({
          id: z.string(),
          description: z.string().optional(),
          progress: z.number().min(0).max(100),
          completed: z.boolean().optional(),
          unlocked: z.boolean().optional()
        }))
      });
      
      const validatedData = achievementBatchSchema.parse({ achievements });
      
      const { upsertMany } = await import("./dal/achievements");
      const results = await upsertMany(authReq.user.id, validatedData.achievements.map(a => ({
        name: a.id, // Map client ID to achievement name
        description: a.description || '',
        progress: a.progress,
        unlocked: a.completed || a.unlocked || false
      })));
      
      res.json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid achievements data", errors: error.issues });
      }
      console.error("Failed to batch update achievements:", error);
      res.status(500).json({ message: "Failed to update achievements" });
    }
  });

  // Health Reports routes
  app.get("/api/health-reports", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const days = parseInt(req.query.days as string) || 14;
      
      // Get base health reports
      const { listReports } = await import("./dal/reports");
      const reports = await listReports(authReq.user.id, { days });
      
      // Check if user has location consent and cached coordinates (using raw SQL like /api/me/location)
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const profileResult = await db.execute(sql`
        SELECT last_lat, last_lon 
        FROM profiles 
        WHERE user_id = ${authReq.user.id}
        LIMIT 1
      `);
      
      const profileRow = profileResult.rows[0];
      const hasLocationConsent = false && // Temporarily disabled until schema is updated
                                profileRow?.last_lat !== null && 
                                profileRow?.last_lon !== null;
      
      if (hasLocationConsent) {
        // Fetch environmental data for reports with cached coordinates
        const { getEnvironment } = await import("./services/environment");
        const lat = Number(profileRow.last_lat);
        const lon = Number(profileRow.last_lon);
        
        // Enrich each report with environmental data for its date
        const enrichedReports = await Promise.all(
          reports.map(async (report) => {
            try {
              const environmentData = await getEnvironment(lat, lon, report.date);
              return {
                ...report,
                environment: environmentData
              };
            } catch (error) {
              console.error(`Failed to fetch environment data for report ${report.id}:`, error);
              // Return report without environment data if fetch fails
              return report;
            }
          })
        );
        
        console.log(`[HEALTH-REPORTS] Enriched ${enrichedReports.length} reports with environmental data using cached location`);
        res.json(enrichedReports);
      } else {
        console.log('[HEALTH-REPORTS] No location consent or cached coordinates - returning reports without environmental data');
        res.json(reports);
      }
    } catch (error) {
      console.error('Failed to fetch health reports:', error);
      res.status(500).json({ message: "Failed to fetch health reports" });
    }
  });

  // Wearables routes
  app.get("/api/wearables", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const wearables = await listWearables(authReq.user.id);
      res.json(wearables);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wearables" });
    }
  });

  // Individual wearable update
  app.put("/api/wearables/:id", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { connected, lastSync } = req.body;
      
      // Find existing wearable first
      const wearables = await listWearables(authReq.user.id);
      const existingWearable = wearables.find(w => w.id === req.params.id);
      
      if (!existingWearable) {
        return res.status(404).json({ message: "Wearable not found" });
      }
      
      // Use upsert to update the wearable
      const { upsertWearable } = await import("./dal/wearables");
      const wearable = await upsertWearable({
        userId: authReq.user.id,
        provider: existingWearable.provider,
        connected: connected !== undefined ? connected : existingWearable.connected,
        lastSync: lastSync ? new Date(lastSync).toISOString() : existingWearable.lastSync
      });
      
      if (!wearable) {
        return res.status(404).json({ message: "Wearable not found" });
      }
      
      res.json(wearable);
    } catch (error) {
      console.error("Failed to update wearable:", error);
      res.status(500).json({ message: "Failed to update wearable" });
    }
  });

  // Wearable connection toggle
  app.post("/api/wearables/toggle", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { provider, connected } = req.body;
      
      const { upsertWearable } = await import("./dal/wearables");
      const wearable = await upsertWearable({
        userId: authReq.user.id,
        provider,
        connected,
        lastSync: connected ? new Date().toISOString() : null
      });
      
      res.json(wearable);
    } catch (error) {
      console.error("Failed to toggle wearable:", error);
      res.status(500).json({ message: "Failed to toggle wearable connection" });
    }
  });

  // Individual wearable sync
  app.post("/api/wearables/:id/sync", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Find the wearable by ID first
      const wearables = await listWearables(authReq.user.id);
      const wearable = wearables.find(w => w.id === req.params.id);
      
      if (!wearable) {
        return res.status(404).json({ message: "Wearable not found" });
      }
      
      // Generate and insert mock health report for today
      const { insertReport } = await import("./dal/reports");
      const today = new Date().toISOString().split('T')[0];
      
      const mockMetrics = {
        restingHeartRate: Math.floor(Math.random() * (75 - 45) + 45),
        hrv: Math.floor(Math.random() * (80 - 20) + 20),
        sleepScore: Math.floor(Math.random() * (100 - 60) + 60),
        steps: Math.floor(Math.random() * 5000) + 7000,
        calories: Math.floor(Math.random() * 1000) + 2200,
        workoutsCompleted: Math.floor(Math.random() * 2),
        totalWorkoutTime: Math.floor(Math.random() * 60),
        avgIntensity: Math.floor(Math.random() * 5) + 5,
        newPRs: Math.floor(Math.random() * 2),
        streakDays: Math.floor(Math.random() * 10),
        weeklyGoalProgress: Math.floor(Math.random() * 30) + 70
      };
      
      const report = await insertReport({
        userId: authReq.user.id,
        date: today,
        summary: `Health data synced from ${wearable.provider}`,
        metrics: mockMetrics,
        suggestions: [
          `Data synced from ${wearable.provider}`,
          'Your metrics look good today',
          'Keep up the great work!'
        ]
      });
      
      res.json({ wearable: wearable.provider, report });
    } catch (error) {
      console.error("Failed to sync wearable:", error);
      res.status(500).json({ message: "Failed to sync wearable data" });
    }
  });

  // Wearable sync (legacy endpoint)
  app.post("/api/wearables/sync", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { provider } = req.body;
      
      // Update wearable last sync
      const { upsertWearable } = await import("./dal/wearables");
      await upsertWearable({
        userId: authReq.user.id,
        provider,
        connected: true,
        lastSync: new Date().toISOString()
      });
      
      // Insert mock health report for today
      const { insertReport } = await import("./dal/reports");
      const today = new Date().toISOString().split('T')[0];
      
      const mockMetrics = {
        restingHeartRate: Math.floor(Math.random() * (75 - 45) + 45),
        hrv: Math.floor(Math.random() * (80 - 20) + 20),
        sleepScore: Math.floor(Math.random() * (100 - 60) + 60)
      };
      
      const report = await insertReport({
        userId: authReq.user.id,
        date: today,
        summary: `Health data synced from ${provider}`,
        metrics: mockMetrics,
        suggestions: ['Stay hydrated', 'Consider light exercise']
      });
      
      res.json({ wearable: provider, report });
    } catch (error) {
      console.error("Failed to sync wearable:", error);
      res.status(500).json({ message: "Failed to sync wearable data" });
    }
  });

  // Enhanced workout generation endpoint with prompt template
  app.post("/api/generate-workout", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Debug logging for auth and DB operations
      const hasBearer = req.headers.authorization?.startsWith('Bearer ') || false;
      const userId = authReq.user?.id;
      
      console.log(`🔍 Generate Workout Debug:`, {
        userId: userId,
        email: authReq.user?.email,
        hasBearer: hasBearer,
        timestamp: new Date().toISOString()
      });
      
      if (!authReq.user) {
        console.log(`❌ Missing user in request despite requireAuth`);
        return res.status(401).json({ message: "missing bearer" });
      }
      
      // Enhanced schema with context data
      const enhancedWorkoutRequestSchema = workoutRequestSchema.extend({
        recentPRs: z.array(z.object({
          exercise: z.string(),
          weight: z.number().optional(),
          reps: z.number().optional(),
          date: z.string(),
          unit: z.string().optional()
        })).optional(),
        lastWorkouts: z.array(z.object({
          name: z.string(),
          category: z.string(),
          duration: z.number(),
          intensity: z.number(),
          date: z.string(),
          exercises: z.array(z.string())
        })).optional(),
        todaysReport: z.object({
          energy: z.number(),
          stress: z.number(),
          sleep: z.number(),
          soreness: z.number()
        }).optional()
      });

      const validatedData = enhancedWorkoutRequestSchema.parse(req.body);
      const generatedWorkout = await generateWorkout(validatedData);
      
      // Insert workout into database
      console.log(`📝 About to insert workout for user: ${authReq.user.id}`);
      
      const dbWorkout = await insertWorkout({
        userId: authReq.user.id,
        workout: {
          title: generatedWorkout.name,
          request: validatedData,
          sets: generatedWorkout.sets || [],
          notes: generatedWorkout.description,
          completed: false
        }
      });
      
      if (!dbWorkout) {
        throw new Error('Failed to insert workout into database');
      }
      
      console.log(`✅ Successfully inserted workout with ID: ${dbWorkout.id}`);
      
      // Return the DB row id for navigation
      res.json({ 
        ...generatedWorkout,
        id: dbWorkout.id,
        dbId: dbWorkout.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Provide friendly validation error messages
        const friendlyErrors = error.issues.map(issue => {
          switch (issue.path.join('.')) {
            case 'category':
              return 'Please select a valid workout category (CrossFit, Strength, HIIT, Cardio, or Powerlifting)';
            case 'duration': 
              return 'Workout duration must be between 5 and 120 minutes';
            case 'intensity':
              return 'Intensity level must be between 1 and 10';
            case 'recentPRs':
              return 'Recent PRs data format is invalid';
            case 'lastWorkouts':
              return 'Recent workouts data format is invalid';
            case 'todaysReport':
              return 'Today\'s wellness report data format is invalid';
            default:
              return `Invalid ${issue.path.join('.')}: ${issue.message}`;
          }
        });
        
        return res.status(400).json({ 
          message: "Invalid workout request data",
          errors: friendlyErrors,
          details: "Please check your request parameters and try again"
        });
      }
      
      console.error("Workout generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate workout",
        error: "An internal error occurred while generating your workout. Please try again." 
      });
    }
  });

  // Statistics endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const userId = "demo-user";
      const workouts = await storage.getWorkouts(userId);
      const prs = await storage.getPersonalRecords(userId);
      
      const totalWorkouts = workouts.length;
      const totalTime = 0; // Duration not available in workout schema
      const avgWorkoutTime = 0;
      const currentStreak = 12; // Mock streak calculation
      const weeklyWorkouts = 4; // Mock weekly count

      res.json({
        totalWorkouts,
        totalTime,
        avgWorkoutTime,
        currentStreak,
        weeklyWorkouts,
        totalPRs: prs.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Basic health check endpoint
  app.get("/__health", (req, res) => {
    res.json({ 
      ok: true, 
      envPort: process.env.PORT ?? null 
    });
  });

  // Health check for Supabase environment and connectivity
  app.get("/api/health/supabase", async (req, res) => {
    try {
      const clientEnvPresent = Boolean(
        process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
      );
      
      const serverEnvPresent = Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      let canQuery = false;
      if (serverEnvPresent) {
        try {
          const { supabaseAdmin } = await import("./lib/supabaseAdmin");
          await supabaseAdmin.from("workouts").select("id").limit(1);
          canQuery = true;
        } catch (error) {
          canQuery = false;
        }
      }

      res.json({
        clientEnvPresent,
        serverEnvPresent,
        canQuery
      });
    } catch (error) {
      res.status(500).json({
        clientEnvPresent: false,
        serverEnvPresent: false,
        canQuery: false
      });
    }
  });

  // Development debug route for email provider status
  // Development user creation endpoint (bypasses email confirmation)
  app.post("/api/dev/create-test-user", async (req, res) => {
    try {
      // Only allow in development mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: "Not found" });
      }

      const { supabaseAdmin } = await import("./lib/supabaseAdmin");
      
      // Create test user with email confirmation bypassed
      const testEmail = "athlete@axlapp.com";
      const testPassword = "password123!";
      
      // Check if user already exists by email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers.users?.find(user => user.email === testEmail);
      
      if (existingUser) {
        return res.json({
          message: "Test user already exists",
          email: testEmail,
          userId: existingUser.id
        });
      }
      
      // Create user with email_confirm_change: false to bypass email verification
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true, // Mark email as confirmed
        user_metadata: {
          first_name: "Test",
          last_name: "Athlete"
        }
      });
      
      if (createError) {
        console.error("Failed to create test user:", createError);
        return res.status(500).json({
          error: "Failed to create test user",
          details: createError.message
        });
      }

      res.json({
        message: "Test user created successfully",
        email: testEmail,
        userId: newUser.user?.id,
        instructions: "Use these credentials to sign in: athlete@axlapp.com / password123!"
      });

    } catch (error) {
      console.error("Create test user error:", error);
      res.status(500).json({
        error: "Failed to create test user",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/dev/debug/email", async (req, res) => {
    try {
      // Only allow in development mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: "Not found" });
      }

      const serverEnvPresent = Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      if (!serverEnvPresent) {
        return res.status(500).json({
          error: "Supabase admin configuration missing",
          emailConfirm: false,
          passwordless: false
        });
      }

      try {
        const { supabaseAdmin } = await import("./lib/supabaseAdmin");
        
        // Test basic admin API connectivity
        const { data: testData, error: testError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (testError) {
          console.error("Admin API test failed:", testError);
          return res.status(500).json({
            error: "Admin API access failed",
            details: testError.message,
            emailConfirm: false,
            passwordless: false
          });
        }

        // Basic auth configuration status
        // Note: Full settings require Management API, but we can infer some things
        const response = {
          adminConnectivity: true,
          emailConfirm: true, // Assume true since custom SMTP is configured
          passwordless: true, // Magic links are supported
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
          supabaseUrl: process.env.SUPABASE_URL ? 'configured' : 'missing',
          customSmtpConfigured: true, // Based on user's setup with Resend
          userCount: testData?.users?.length || 0
        };

        res.json(response);

      } catch (error) {
        console.error("Debug email status error:", error);
        res.status(500).json({
          error: "Failed to check email provider status",
          details: error instanceof Error ? error.message : "Unknown error",
          emailConfirm: false,
          passwordless: false
        });
      }

    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({
        error: "Debug endpoint failed",
        emailConfirm: false,
        passwordless: false
      });
    }
  });

  // TEMPORARY TEST ROUTE for DAL verification
  app.get("/api/test/dal", async (req, res) => {
    try {
      // Import DAL methods
      const { insertWorkout, listWorkouts } = await import("./dal/workouts");
      
      console.log("🧪 Testing DAL connectivity...");
      
      // Test user ID for demonstration
      const testUserId = "00000000-0000-0000-0000-000000000000"; // Test UUID
      
      // Test inserting a workout
      const testWorkout = await insertWorkout({
        userId: testUserId,
        workout: {
          title: "DAL Test Workout",
          request: { category: "Test", duration: 30 },
          sets: { exercise1: { reps: 10, weight: 100 } },
          notes: "Test workout from DAL",
          completed: false
        }
      });
      
      if (!testWorkout) {
        throw new Error('Failed to insert test workout');
      }
      
      console.log(`✅ Inserted test workout with ID: ${testWorkout.id}`);
      
      // Test listing workouts
      const workouts = await listWorkouts(testUserId, { limit: 5 });
      console.log(`✅ Listed ${workouts.length} workouts for user`);
      
      res.json({
        message: "DAL test successful",
        testWorkout: {
          id: testWorkout.id,
          title: testWorkout.title,
          createdAt: testWorkout.createdAt
        },
        totalWorkouts: workouts.length
      });
      
    } catch (error) {
      console.error("❌ DAL test failed:", error);
      res.status(500).json({ 
        message: "DAL test failed", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Health endpoint for suggestions system
  app.get("/api/health/suggestions", async (req, res) => {
    try {
      const todayRows = await getTodaySuggestionsCount();
      const lastRunAt = getLastRunAt();
      
      res.json({
        todayRows,
        lastRunAt: lastRunAt ? lastRunAt.toISOString() : null
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({ message: "Failed to get suggestions health info" });
    }
  });

  // Admin endpoint to manually trigger cron (for testing)
  app.post("/api/admin/cron/suggestions", requireAuth, async (req, res) => {
    try {
      console.log("🔧 [ADMIN] Manual cron trigger requested");
      const result = await generateDailySuggestions();
      
      res.json({
        success: true,
        message: "Daily suggestions cron executed manually",
        result: result
      });
    } catch (error) {
      console.error("Admin cron trigger error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to execute cron job",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoints for monitoring auth and database operations
  app.get("/api/debug/session", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      res.json({
        userId: authReq.user.id,
        email: authReq.user.email
      });
    } catch (error) {
      console.error("Debug session error:", error);
      res.status(500).json({ message: "Failed to get session debug info" });
    }
  });

  app.get("/api/debug/workouts", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Get count and last 5 workout IDs
      const { supabaseAdmin } = await import("./lib/supabaseAdmin");
      const { data: workouts, error: workoutsError } = await supabaseAdmin
        .from('workouts')
        .select('id, created_at')
        .eq('user_id', authReq.user.id)
        .order('created_at', { ascending: false });
      
      if (workoutsError) {
        throw new Error(`Workouts query failed: ${workoutsError.message}`);
      }

      res.json({
        count: workouts?.length || 0,
        last5Ids: workouts?.slice(0, 5).map((w: { id: string }) => w.id) || []
      });
    } catch (error) {
      console.error("Debug workouts error:", error);
      res.status(500).json({ message: "Failed to get workouts debug info" });
    }
  });

  // Workout feedback endpoint
  app.post("/api/workouts/feedback", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { 
        workoutId, 
        generationId,
        intensityFeedback, 
        difficultyRating, 
        rpe, 
        completionPercentage, 
        overallSatisfaction,
        comments,
        sessionDuration
      } = req.body;
      
      // Validate required fields
      if (!workoutId) {
        return res.status(400).json({ 
          success: false, 
          message: "workoutId is required" 
        });
      }

      // Validate intensity feedback if provided (legacy support)
      if (intensityFeedback !== undefined && (typeof intensityFeedback !== 'number' || intensityFeedback < 1 || intensityFeedback > 10)) {
        return res.status(400).json({ 
          success: false, 
          message: "intensityFeedback must be between 1-10" 
        });
      }

      // Validate other feedback fields if provided
      if (rpe !== undefined && (typeof rpe !== 'number' || rpe < 1 || rpe > 10)) {
        return res.status(400).json({ 
          success: false, 
          message: "RPE must be between 1-10" 
        });
      }

      if (completionPercentage !== undefined && (typeof completionPercentage !== 'number' || completionPercentage < 0 || completionPercentage > 100)) {
        return res.status(400).json({ 
          success: false, 
          message: "Completion percentage must be between 0-100" 
        });
      }

      if (overallSatisfaction !== undefined && (typeof overallSatisfaction !== 'number' || overallSatisfaction < 1 || overallSatisfaction > 10)) {
        return res.status(400).json({ 
          success: false, 
          message: "Overall satisfaction must be between 1-10" 
        });
      }

      if (difficultyRating !== undefined && !['easy', 'moderate', 'hard'].includes(difficultyRating)) {
        return res.status(400).json({ 
          success: false, 
          message: "Difficulty rating must be 'easy', 'moderate', or 'hard'" 
        });
      }

      // Update workout feedback in database
      const { updateWorkout } = await import("./dal/workouts");
      const feedbackData = {
        intensityFeedback,
        difficultyRating,
        rpe,
        completionPercentage,
        overallSatisfaction,
        comments,
        sessionDuration,
        submittedAt: new Date().toISOString(),
        userId: authReq.user.id
      };
      
      await updateWorkout(authReq.user.id, workoutId, { feedback: feedbackData });

      // Log telemetry for RL training data collection
      try {
        const { logFeedbackEvent } = await import("./workouts/telemetry.js");
        
        // Log each type of feedback as separate events for better data analysis
        const feedbackEvents = [];
        
        if (difficultyRating !== undefined) {
          feedbackEvents.push({
            feedbackType: 'difficulty' as const,
            difficultyRating,
            comments,
            sessionDuration
          });
        }

        if (rpe !== undefined) {
          feedbackEvents.push({
            feedbackType: 'rpe' as const,
            rpe,
            comments,
            sessionDuration
          });
        }

        if (completionPercentage !== undefined) {
          feedbackEvents.push({
            feedbackType: 'completion' as const,
            completionPercentage,
            comments,
            sessionDuration
          });
        }

        if (overallSatisfaction !== undefined || intensityFeedback !== undefined) {
          feedbackEvents.push({
            feedbackType: 'overall' as const,
            overallSatisfaction,
            comments,
            sessionDuration
          });
        }

        // Log all feedback events if generationId is provided
        if (generationId && feedbackEvents.length > 0) {
          for (const eventData of feedbackEvents) {
            await logFeedbackEvent(authReq.user.id, workoutId, generationId, eventData);
          }
        } else {
          console.log('📝 [TELEMETRY] Feedback received but no generationId provided for linking');
        }
        
      } catch (telemetryError) {
        // Don't fail the request if telemetry fails
        console.error('❌ [TELEMETRY] Failed to log feedback event:', telemetryError);
      }

      res.json({ success: true, message: "Feedback saved successfully" });
    } catch (error) {
      console.error("Feedback submission error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to save feedback" 
      });
    }
  });

  // New workout feedback endpoint - inserts into workout_feedback table
  app.post("/api/workouts/:id/feedback", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const workoutId = req.params.id;
      const { perceivedIntensity, notes } = req.body;
      
      // Validate with Zod schema
      const feedbackData = insertWorkoutFeedbackSchema.parse({
        workoutId,
        userId: authReq.user.id,
        perceivedIntensity,
        notes: notes || null,
      });
      
      // Insert into workout_feedback table
      const { supabaseAdmin } = await import("./lib/supabaseAdmin");
      const { data, error } = await supabaseAdmin
        .from('workout_feedback')
        .insert({
          workout_id: feedbackData.workoutId,
          user_id: feedbackData.userId,
          perceived_intensity: feedbackData.perceivedIntensity,
          notes: feedbackData.notes,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to insert workout feedback:', error);
        return res.status(400).json({ 
          error: 'Invalid feedback data',
          details: error 
        });
      }
      
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Workout feedback submission error:", error);
      
      // Return Zod validation errors with proper format
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: 'Invalid feedback data',
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to save feedback',
        message: error.message 
      });
    }
  });

  // Test endpoint for new DAL functions
  app.get("/api/debug/dal-functions", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Test the new DAL functions
      const rpe = await getRecentRPE(userId, 24);
      const zoneMinutes = await getZoneMinutes14d(userId);
      const strain = await getStrain(userId, 24);
      
      res.json({
        message: "DAL functions tested successfully",
        results: {
          recentRPE: rpe,
          zoneMinutes14d: zoneMinutes,
          strain24h: strain
        }
      });
    } catch (error: any) {
      console.error("DAL function test error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API 404 handler - must be after all API routes but before SPA fallback
  app.use('/api/*', (req, res) => {
    res.type('application/json');
    res.status(404).json({ 
      ok: false, 
      error: { code: 'NOT_FOUND', message: `API endpoint ${req.path} not found` } 
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
