import type { Express } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { parseFreeform } from "../logic/freeform";
import { insertWorkout } from "../dal/workouts";

export function registerWorkoutFreeformRoutes(app: Express) {
  // Size limit middleware for text input (8-12 KB)
  const textSizeLimit = (req: any, res: any, next: any) => {
    if (req.body.text && req.body.text.length > 12000) {
      return res.status(400).json({ message: "Text description too long (max 12KB)" });
    }
    next();
  };

  // Parse freeform workout description
  app.post("/api/workouts/parse-freeform", requireAuth, textSizeLimit, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { text } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: "Text description is required" });
      }
      
      const parsed = await parseFreeform(text, authReq.user.id);
      res.json({ parsed });
    } catch (error) {
      console.error("Failed to parse workout:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage.includes("Rate limit exceeded")) {
        return res.status(429).json({ message: errorMessage });
      }
      if (errorMessage.includes("Invalid")) {
        return res.status(400).json({ message: errorMessage });
      }
      
      res.status(500).json({ 
        message: "Failed to parse workout description",
        error: errorMessage
      });
    }
  });

  // Log freeform workout to database
  app.post("/api/workouts/log-freeform", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { parsed } = req.body;
      
      if (!parsed || !parsed.request || !parsed.sets || !parsed.title) {
        return res.status(400).json({ message: "Invalid parsed workout data" });
      }
      
      // Transform freeform parsed data to match UI schema
      const transformedSets = parsed.sets.map((set: any, index: number) => ({
        id: `freeform-${index}`, // Generate IDs for the sets
        exercise: set.movement, // Convert 'movement' to 'exercise'
        weight: set.weightKg ? Math.round(set.weightKg * 2.20462 * 2) / 2 : undefined, // Convert kg to lbs, round to nearest 0.5
        reps: set.reps,
        duration: set.timeCapMinutes ? set.timeCapMinutes * 60 : undefined, // Convert minutes to seconds
        distance: undefined, // Not provided in freeform parsing
        restTime: undefined, // Not provided in freeform parsing  
        notes: set.notes,
        repScheme: set.repScheme, // Keep repScheme for reference
        timeCapMinutes: set.timeCapMinutes
      }));

      // Insert workout into database
      const workout = await insertWorkout({
        userId: authReq.user.id,
        workout: {
          title: parsed.title,
          request: parsed.request,
          sets: transformedSets, // Use transformed sets
          notes: parsed.notes || null,
          completed: true,
          feedback: {
            source: "freeform",
            confidence: parsed.confidence
          }
        }
      });
      
      res.json({ id: workout.id });
    } catch (error) {
      console.error("Failed to log freeform workout:", error);
      res.status(500).json({ 
        message: "Failed to save workout",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}