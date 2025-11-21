import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { deviceTokens } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { sendAPNs, sendAPNsBatch, isAPNsConfigured } from '../lib/apns';

const router = Router();

// POST /api/push/register-device - Register device token for push notifications
router.post('/register-device', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = z.object({
      token: z.string().min(1),
      platform: z.enum(['ios', 'web']).default('ios'),
    });
    
    const { token, platform } = bodySchema.parse(req.body);
    
    console.log(`[PUSH_NATIVE] Registering device token for user ${userId}, platform: ${platform}`);
    
    // Upsert device token (insert or update last_seen if already exists)
    await db
      .insert(deviceTokens)
      .values({
        userId,
        platform,
        token,
      } as any)
      .onConflictDoUpdate({
        target: [deviceTokens.userId, deviceTokens.token],
        set: {
          lastSeen: new Date(),
          platform, // Update platform in case it changed
        } as any,
      });
    
    console.log(`[PUSH_NATIVE] Device token registered successfully for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Device token registered successfully',
      platform,
      registeredAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[PUSH_NATIVE] Error registering device token:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: error.issues,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to register device token',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/push/test - Unified test endpoint for both native and web push
router.post('/test', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = z.object({
      title: z.string().default('Test Notification'),
      body: z.string().default('This is a test push notification from AXLE!'),
      data: z.record(z.any()).optional(),
    });
    
    const { title, body, data } = bodySchema.parse(req.body);
    
    console.log(`[PUSH_NATIVE] Sending test notification to user ${userId}`);
    
    // Get user's device tokens
    const userTokens = await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId));
    
    if (userTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No device tokens found for user',
        hint: 'Please register for push notifications first',
      });
    }
    
    console.log(`[PUSH_NATIVE] Found ${userTokens.length} device tokens for user ${userId}`);
    
    const results = [];
    
    // Check if APNs is configured
    const apnsConfigured = isAPNsConfigured();
    
    for (const deviceToken of userTokens) {
      try {
        if (deviceToken.platform === 'ios' && apnsConfigured) {
          // Send actual APNs notification
          const result = await sendAPNs(deviceToken.token, { title, body, data });
          
          results.push({
            platform: deviceToken.platform,
            tokenPreview: deviceToken.token.substring(0, 10) + '...',
            status: result.success ? 'sent' : 'failed',
            error: result.error,
            apnsId: result.apnsId,
            timestamp: new Date().toISOString(),
          });
        } else if (deviceToken.platform === 'web') {
          // Web push - send via web push
          console.log(`[PUSH_NATIVE] Sending web push notification to: ${deviceToken.token.substring(0, 10)}...`);
          
          try {
            // Import web-push library
            const webpush = await import('web-push');
            
            // Configure VAPID keys
            webpush.setVapidDetails(
              process.env.VAPID_SUBJECT || 'mailto:admin@axle.app',
              process.env.VAPID_PUBLIC_KEY!,
              process.env.VAPID_PRIVATE_KEY!
            );
            
            // Parse the stored web push subscription
            const subscription = JSON.parse(deviceToken.token);
            
            // Send web push notification
            await webpush.sendNotification(subscription, JSON.stringify({
              title,
              body,
              data,
              icon: '/icon-192x192.png',
            }));
            
            results.push({
              platform: deviceToken.platform,
              tokenPreview: deviceToken.token.substring(0, 10) + '...',
              status: 'sent',
              timestamp: new Date().toISOString(),
            });
          } catch (webPushError) {
            console.error(`[PUSH_NATIVE] Web push error:`, webPushError);
            results.push({
              platform: deviceToken.platform,
              tokenPreview: deviceToken.token.substring(0, 10) + '...',
              status: 'failed',
              error: webPushError instanceof Error ? webPushError.message : 'Web push failed',
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          // APNs not configured or unknown platform
          console.log(`[PUSH_NATIVE] APNs not configured or unknown platform ${deviceToken.platform}: ${deviceToken.token.substring(0, 10)}...`);
          
          results.push({
            platform: deviceToken.platform,
            tokenPreview: deviceToken.token.substring(0, 10) + '...',
            status: 'simulated',
            error: apnsConfigured ? 'Unknown platform' : 'APNs not configured',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`[PUSH_NATIVE] Failed to send to device ${deviceToken.id}:`, error);
        results.push({
          platform: deviceToken.platform,
          tokenPreview: deviceToken.token.substring(0, 10) + '...',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    res.json({
      success: true,
      message: `Test notification sent to ${userTokens.length} device(s)`,
      notification: { title, body, data },
      results,
      apnsConfigured,
    });
    
  } catch (error) {
    console.error('[PUSH_NATIVE] Error sending test notification:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: error.issues,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/push/devices - List user's registered devices
router.get('/devices', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const devices = await db
      .select({
        id: deviceTokens.id,
        platform: deviceTokens.platform,
        tokenPreview: deviceTokens.token, // Will be truncated in response
        createdAt: deviceTokens.createdAt,
        lastSeen: deviceTokens.lastSeen,
      })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId))
      .orderBy(deviceTokens.lastSeen);
    
    // Truncate token for security in response
    const safeDevices = devices.map(device => ({
      ...device,
      tokenPreview: device.tokenPreview.substring(0, 10) + '...',
    }));
    
    res.json({
      success: true,
      devices: safeDevices,
      count: devices.length,
    });
    
  } catch (error) {
    console.error('[PUSH_NATIVE] Error listing devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list devices',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/push/unregister-device - Remove device token by token value
router.post('/unregister-device', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = z.object({
      token: z.string().min(1),
    });
    
    const { token } = bodySchema.parse(req.body);
    
    console.log(`[PUSH_NATIVE] Unregistering device token for user ${userId}`);
    
    const result = await db
      .delete(deviceTokens)
      .where(
        and(
          eq(deviceTokens.userId, userId),
          eq(deviceTokens.token, token)
        )
      );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found',
      });
    }
    
    console.log(`[PUSH_NATIVE] Device token unregistered successfully for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Device token unregistered successfully',
    });
    
  } catch (error) {
    console.error('[PUSH_NATIVE] Error unregistering device token:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: error.issues,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to unregister device token',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/push/devices/:deviceId - Remove a device token
router.delete('/devices/:deviceId', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { deviceId } = req.params;
    
    const result = await db
      .delete(deviceTokens)
      .where(
        and(
          eq(deviceTokens.id, deviceId),
          eq(deviceTokens.userId, userId)
        )
      );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or not owned by user',
      });
    }
    
    console.log(`[PUSH_NATIVE] Removed device token ${deviceId} for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Device token removed successfully',
    });
    
  } catch (error) {
    console.error('[PUSH_NATIVE] Error removing device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove device',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/push/debug/devices - Debug route to list user's device tokens (development only)
router.get('/debug/devices', requireAuth, async (req, res) => {
  try {
    // Restrict debug route to non-production environments
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Debug endpoints are not available in production',
      });
    }

    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    console.log(`[PUSH_NATIVE] Debug: listing device tokens for user ${userId}`);
    
    const devices = await db
      .select({
        id: deviceTokens.id,
        platform: deviceTokens.platform,
        token: deviceTokens.token,
        createdAt: deviceTokens.createdAt,
        lastSeen: deviceTokens.lastSeen,
      })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId))
      .orderBy(deviceTokens.lastSeen);
    
    console.log(`[PUSH_NATIVE] Debug: found ${devices.length} device tokens for user ${userId}`);
    
    // Show token previews and metadata for debugging
    const debugDevices = devices.map(device => ({
      id: device.id,
      platform: device.platform,
      tokenPreview: device.token.substring(0, 10) + '...',
      tokenLength: device.token.length,
      createdAt: device.createdAt,
      lastSeen: device.lastSeen,
    }));
    
    res.json({
      success: true,
      userId,
      deviceCount: devices.length,
      devices: debugDevices,
      environment: process.env.NODE_ENV || 'development',
      apnsHost: process.env.NODE_ENV === 'production' 
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com',
      warning: 'This debug endpoint is only available in development environments',
    });
    
  } catch (error) {
    console.error('[PUSH_NATIVE] Error in debug devices route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list debug devices',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;