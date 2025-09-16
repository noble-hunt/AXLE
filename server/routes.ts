import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertWorkoutSchema, 
  insertPersonalRecordSchema, 
  insertAchievementSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Workout routes
  app.get("/api/workouts", async (req, res) => {
    try {
      // For demo purposes, using a default user ID
      const userId = "demo-user";
      const workouts = await storage.getWorkouts(userId);
      res.json(workouts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workouts" });
    }
  });

  app.get("/api/workouts/:id", async (req, res) => {
    try {
      const workout = await storage.getWorkout(req.params.id);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      res.json(workout);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workout" });
    }
  });

  app.post("/api/workouts", async (req, res) => {
    try {
      const validatedData = insertWorkoutSchema.parse(req.body);
      const workout = await storage.createWorkout(validatedData);
      res.status(201).json(workout);
    } catch (error) {
      res.status(400).json({ message: "Invalid workout data" });
    }
  });

  app.put("/api/workouts/:id", async (req, res) => {
    try {
      const partialData = insertWorkoutSchema.partial().parse(req.body);
      const workout = await storage.updateWorkout(req.params.id, partialData);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      res.json(workout);
    } catch (error) {
      res.status(400).json({ message: "Invalid workout data" });
    }
  });

  app.delete("/api/workouts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWorkout(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Workout not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete workout" });
    }
  });

  // Personal Records routes
  app.get("/api/personal-records", async (req, res) => {
    try {
      const userId = "demo-user";
      const prs = await storage.getPersonalRecords(userId);
      res.json(prs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch personal records" });
    }
  });

  app.post("/api/personal-records", async (req, res) => {
    try {
      const validatedData = insertPersonalRecordSchema.parse(req.body);
      const pr = await storage.createPersonalRecord(validatedData);
      res.status(201).json(pr);
    } catch (error) {
      res.status(400).json({ message: "Invalid personal record data" });
    }
  });

  // Achievements routes
  app.get("/api/achievements", async (req, res) => {
    try {
      const userId = "demo-user";
      const achievements = await storage.getAchievements(userId);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.post("/api/achievements", async (req, res) => {
    try {
      const validatedData = insertAchievementSchema.parse(req.body);
      const achievement = await storage.createAchievement(validatedData);
      res.status(201).json(achievement);
    } catch (error) {
      res.status(400).json({ message: "Invalid achievement data" });
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

  const httpServer = createServer(app);
  return httpServer;
}
