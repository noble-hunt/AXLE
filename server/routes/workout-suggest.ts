// server/routes/workout-suggest.ts
import type { Express } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireJSON } from '../middleware/accept-json';
import { computeTodaySuggestion, startSuggestion } from '../services/suggestions';
import { API_ENDPOINTS } from '@shared/endpoints';

/**
 * Register workout suggestion routes as specified in the backend requirements
 * These routes provide JSON-only endpoints for fetching and starting suggestions
 */
export function registerWorkoutSuggestionRoutes(app: Express) {
  
  /**
   * GET /api/workouts/suggest/today
   * 
   * Fetches today's workout suggestion for the authenticated user.
   * Returns JSON with suggestion config and rationale.
   * This is an alias/wrapper around the existing suggestion system.
   */
  app.get(API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY, requireJSON, requireAuth, async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      const suggestion = await computeTodaySuggestion(userId);
      
      res.json({ suggestion });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/workouts/suggest/today/start
   * 
   * Generates and persists an actual workout from today's suggestion.
   * Returns JSON with the created workout ID.
   * Uses existing workout generation and persistence pipeline.
   */
  app.post(API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY_START, requireJSON, requireAuth, async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      const result = await startSuggestion(userId);
      
      res.status(201).json({ workoutId: result.workoutId });
    } catch (error) {
      next(error);
    }
  });
}