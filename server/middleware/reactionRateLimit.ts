import { Request, Response, NextFunction } from 'express';

interface RateTracker {
  attempts: number[];
  windowStart: number;
}

// In-memory store for rate tracking (could be replaced with Redis in production)
const reactionAttempts = new Map<string, RateTracker>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REACTIONS_PER_WINDOW = 20;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const userIds = Array.from(reactionAttempts.keys());
  
  for (const userId of userIds) {
    const tracker = reactionAttempts.get(userId);
    if (tracker) {
      // Remove old attempts beyond the rate limit window
      tracker.attempts = tracker.attempts.filter(
        (attempt: number) => now - attempt < RATE_LIMIT_WINDOW_MS
      );
      
      // Remove users with no recent attempts
      if (tracker.attempts.length === 0) {
        reactionAttempts.delete(userId);
      }
    }
  }
}, CLEANUP_INTERVAL_MS);

export function reactionRateLimit(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id;
  
  if (!userId) {
    return res.status(401).json({
      message: 'User not authenticated'
    });
  }
  
  const now = Date.now();
  
  // Get or create tracker for this user
  let tracker = reactionAttempts.get(userId);
  if (!tracker) {
    tracker = { attempts: [], windowStart: now };
    reactionAttempts.set(userId, tracker);
  }
  
  // Filter out old attempts outside the rate limit window
  tracker.attempts = tracker.attempts.filter(
    attempt => now - attempt < RATE_LIMIT_WINDOW_MS
  );
  
  // Check if user has exceeded the rate limit
  if (tracker.attempts.length >= MAX_REACTIONS_PER_WINDOW) {
    const oldestAttempt = Math.min(...tracker.attempts);
    const timeUntilReset = RATE_LIMIT_WINDOW_MS - (now - oldestAttempt);
    
    return res.status(429).json({
      message: 'Rate limit exceeded',
      details: `Too many reactions. You can react ${MAX_REACTIONS_PER_WINDOW} times per minute.`,
      retryAfter: Math.ceil(timeUntilReset / 1000),
      rateLimitInfo: {
        max: MAX_REACTIONS_PER_WINDOW,
        windowMs: RATE_LIMIT_WINDOW_MS,
        current: tracker.attempts.length,
        resetTime: new Date(now + timeUntilReset).toISOString()
      }
    });
  }
  
  // Record this attempt
  tracker.attempts.push(now);
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REACTIONS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REACTIONS_PER_WINDOW - tracker.attempts.length));
  res.setHeader('X-RateLimit-Reset', new Date(now + RATE_LIMIT_WINDOW_MS).toISOString());
  
  next();
}