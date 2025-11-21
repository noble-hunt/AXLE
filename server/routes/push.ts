import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { db } from "../db.js";
import { pushSubscriptions } from '../../shared/schema.js';
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const pushRouter = Router();

// POST /api/push/subscribe - Subscribe to web push notifications (idempotent)
pushRouter.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = z.object({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    });
    
    const { endpoint, p256dh, auth } = bodySchema.parse(req.body);
    
    console.log(`[PUSH_WEB] Subscribing to web push for user ${userId}`);
    
    // Upsert subscription (insert or update last_used if already exists)
    await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint,
        p256dh,
        auth,
      } as any)
      .onConflictDoUpdate({
        target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
        set: {
          p256dh,
          auth,
          lastUsed: new Date(),
        } as any,
      });
    
    console.log(`[PUSH_WEB] Web push subscription registered successfully for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Web push subscription registered successfully',
    });
    
  } catch (error) {
    console.error('[PUSH_WEB] Error subscribing to web push:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: error.issues,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to web push',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/push/unsubscribe - Unsubscribe from web push notifications
pushRouter.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = z.object({
      endpoint: z.string().url(),
    });
    
    const { endpoint } = bodySchema.parse(req.body);
    
    console.log(`[PUSH_WEB] Unsubscribing from web push for user ${userId}`);
    
    const result = await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }
    
    console.log(`[PUSH_WEB] Web push unsubscribed successfully for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Web push unsubscribed successfully',
    });
    
  } catch (error) {
    console.error('[PUSH_WEB] Error unsubscribing from web push:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: error.issues,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe from web push',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/push/subscriptions - List user's web push subscriptions
pushRouter.get('/subscriptions', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const subscriptions = await db
      .select({
        id: pushSubscriptions.id,
        endpointPreview: pushSubscriptions.endpoint, // Will be truncated in response
        createdAt: pushSubscriptions.createdAt,
        lastUsed: pushSubscriptions.lastUsed,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(pushSubscriptions.lastUsed);
    
    // Truncate endpoint for security in response
    const safeSubscriptions = subscriptions.map(sub => ({
      ...sub,
      endpointPreview: sub.endpointPreview.substring(0, 50) + '...',
    }));
    
    res.json({
      success: true,
      subscriptions: safeSubscriptions,
      count: subscriptions.length,
    });
    
  } catch (error) {
    console.error('[PUSH_WEB] Error listing subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list subscriptions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default pushRouter;