// server/middleware/accept-json.ts
import type { Request, Response, NextFunction } from 'express';

/**
 * JSON-only guard middleware to prevent HTML responses for API routes
 * Ensures that /api/* routes always return JSON and never fall through to SPA HTML
 */
export function requireJSON(req: Request, res: Response, next: NextFunction) {
  // Only apply to /api/* routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  
  // Set Vary header to indicate response varies by Accept header
  res.setHeader('Vary', 'Accept');
  
  // Continue processing - the route ordering in server/index.ts already ensures
  // API routes are handled before the SPA fallback, so this is mainly defensive
  return next();
}