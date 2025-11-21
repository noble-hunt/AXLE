import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { startSuggestion } from "../services/suggestions.js";

export const suggest = Router();

suggest.post("/start", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  
  try {
    const result = await startSuggestion(userId);
    return res.json({ ok: true, workoutId: result.workoutId });
  } catch (error) {
    console.error('Error starting suggestion:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Failed to start workout from suggestion' 
    });
  }
});