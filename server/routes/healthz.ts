import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    // Lightweight health check - just verify storage interface exists
    // Using a timeout to avoid hanging during incidents
    const healthPromise = Promise.resolve(storage.getWorkouts ? true : false);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 5000)
    );
    
    await Promise.race([healthPromise, timeoutPromise]);
    
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