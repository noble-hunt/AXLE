import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../db.js';
import { notificationPrefs, insertNotificationPrefsSchema } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// POST /api/notification-prefs - Save/update user notification preferences
router.post('/', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = insertNotificationPrefsSchema.extend({
      platform: z.enum(['auto', 'native', 'web']).default('auto'),
    });
    
    const prefs = bodySchema.parse(req.body);
    
    console.log(`[NOTIFICATION_PREFS] Saving preferences for user ${userId}:`, prefs);
    
    // Upsert notification preferences
    await db
      .insert(notificationPrefs)
      .values({
        userId,
        enabled: prefs.enabled,
        dailyReminders: prefs.dailyReminders,
        reminderTime: prefs.reminderTime,
        platform: prefs.platform,
      } as any)
      .onConflictDoUpdate({
        target: [notificationPrefs.userId],
        set: {
          enabled: prefs.enabled,
          dailyReminders: prefs.dailyReminders,
          reminderTime: prefs.reminderTime,
          platform: prefs.platform,
          updatedAt: new Date(),
        } as any,
      });
    
    console.log(`[NOTIFICATION_PREFS] Preferences saved successfully for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Notification preferences saved successfully',
      preferences: prefs,
    });
    
  } catch (error) {
    console.error('[NOTIFICATION_PREFS] Error saving preferences:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: error.issues,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to save notification preferences',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/notification-prefs - Get user notification preferences
router.get('/', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const preferences = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, userId))
      .limit(1);
    
    const userPrefs = preferences[0] || {
      enabled: false,
      dailyReminders: false,
      reminderTime: '09:00',
      platform: 'auto',
    };
    
    res.json({
      success: true,
      preferences: userPrefs,
    });
    
  } catch (error) {
    console.error('[NOTIFICATION_PREFS] Error getting preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification preferences',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;