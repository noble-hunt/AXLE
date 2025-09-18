import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertWorkoutSchema, 
  insertPersonalRecordSchema, 
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

export async function registerRoutes(app: Express): Promise<Server> {
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
      
      // Validate request body
      const workoutData = insertWorkoutSchema.parse({
        title: req.body.title,
        category: req.body.category,
        description: req.body.description,
        duration: req.body.duration,
        intensity: req.body.intensity,
        sets: req.body.sets,
        date: req.body.date,
        completed: req.body.completed,
        notes: req.body.notes
      });
      
      const workout = await insertWorkout({
        userId: authReq.user.id,
        workout: workoutData
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
      const { deleteWorkout } = await import("./dal/workouts");
      const success = await deleteWorkout(authReq.user.id, req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Workout not found" });
      }
      res.json({ message: "Workout deleted successfully" });
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
      
      // Validate request body with Zod schema
      const validatedData = insertPersonalRecordSchema.parse({
        movement: req.body.exercise || req.body.movement,
        category: req.body.category || req.body.movementCategory,
        weight_kg: req.body.unit === 'LBS' ? req.body.weight / 2.20462 : req.body.weight,
        rep_max: req.body.reps || req.body.repMax,
        date: req.body.date
      });
      
      const { insertPR } = await import("./dal/prs");
      const pr = await insertPR({
        userId: authReq.user.id,
        category: validatedData.category,
        movement: validatedData.movement,
        repMax: validatedData.rep_max,
        weightKg: validatedData.weight_kg,
        date: validatedData.date
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
        lastSync: lastSync ? new Date(lastSync).toISOString() : existingWearable.last_sync
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
      const totalTime = workouts.reduce((sum, w) => sum + w.duration, 0);
      const avgWorkoutTime = totalWorkouts > 0 ? Math.round(totalTime / totalWorkouts) : 0;
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

  const httpServer = createServer(app);
  return httpServer;
}
