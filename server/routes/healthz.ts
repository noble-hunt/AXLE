import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    // Test database connectivity by trying to get workouts
    await storage.getWorkouts("health-check-test");
    
    return res.json({ 
      ok: true, 
      ts: Date.now(),
      service: "axle-fitness"
    });
  } catch (e: any) {
    return res.status(500).json({ 
      ok: false, 
      error: String(e),
      ts: Date.now(),
      service: "axle-fitness"
    });
  }
});

export default router;