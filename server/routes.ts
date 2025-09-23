import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertWorkoutSchema, 
  insertPRSchema, 
  insertAchievementSchema 
} from "@shared/schema";
import { generateWorkout } from "./workoutGenerator";
import { workoutRequestSchema, WorkoutRequest } from "../shared/schema";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "./middleware/auth";
import { listWorkouts, getWorkout, insertWorkout, updateWorkout } from "./dal/workouts";
import { listPRs } from "./dal/prs";
import { list as listAchievements } from "./dal/achievements";
import { listReports } from "./dal/reports";
import { listWearables } from "./dal/wearables";
import { registerSuggestionRoutes } from "./routes/suggestions";
import { getTodaySuggestionsCount, getLastRunAt, generateDailySuggestions } from "./jobs/suggestions-cron";
import { registerWorkoutFreeformRoutes } from "./routes/workout-freeform";
import { registerWhisperRoutes } from "./routes/whisper-transcription";
import { registerGroupRoutes } from "./routes/groups";
import { registerWorkoutGenerationRoutes } from "./routes/workout-generation";
import healthRoutes from "./routes/health";
import storageRouter from "./routes/storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register suggestion routes
  registerSuggestionRoutes(app);
  
  // Register workout freeform routes
  registerWorkoutFreeformRoutes(app);
  
  // Register whisper transcription routes
  registerWhisperRoutes(app);
  
  // Register health provider routes
  app.use("/api", healthRoutes);
  
  // Register group routes
  registerGroupRoutes(app);
  
  // Register workout generation routes
  registerWorkoutGenerationRoutes(app);
  
  // Register storage routes
  app.use("/api/storage", storageRouter);
  
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
      res.status(501).json({ message: "Delete workout not implemented" });
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
      const reports = await listReports(authReq.user.id, { days });
      res.json(reports);
    } catch (error) {
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
      
      console.log(`✅ Inserted test workout with ID: ${testWorkout.id}`);
      
      // Test listing workouts
      const workouts = await listWorkouts(testUserId, { limit: 5 });
      console.log(`✅ Listed ${workouts.length} workouts for user`);
      
      res.json({
        message: "DAL test successful",
        testWorkout: {
          id: testWorkout.id,
          title: testWorkout.title,
          created_at: testWorkout.created_at
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

  const httpServer = createServer(app);
  return httpServer;
}
