import { Router } from "express";
import { db } from "../db.js";
import { notificationTopics } from '../../shared/schema.js';
import { eq, and } from "drizzle-orm";
import { sendWeeklyReport } from "../services/weeklyReport.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";

const r = Router();

// POST /api/cron/weekly-reports-run (Admin only for security)
r.post("/api/cron/weekly-reports-run", requireAuth, async (req, res) => {
  // Check if user is admin (uses same logic as admin middleware)
  const authReq = req as AuthenticatedRequest;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim());
  
  if (!adminEmails.includes(authReq.user.email || '')) {
    return res.status(403).json({ 
      success: false,
      error: 'Admin access required for cron operations',
      timestamp: new Date().toISOString()
    });
  }
  try {
    console.log('[CRON] Starting weekly reports job');
    
    // Import Supabase admin client
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");
    
    // Get all users from Supabase auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Adjust as needed for your user base
    });
    
    if (authError) {
      throw new Error(`Failed to fetch users: ${authError.message}`);
    }
    
    const users = authData?.users ?? [];
    let sent = 0;

    for (const user of users) {
      const userId = user.id;
      const email = user.email;
      
      if (!email) continue;
      
      try {
        // Check if user has explicitly disabled weekly reports
        const topicPrefs = await db
          .select()
          .from(notificationTopics)
          .where(
            and(
              eq(notificationTopics.userId, userId),
              eq(notificationTopics.topic, 'weekly-report')
            )
          );
        
        // If user has explicitly disabled weekly reports, skip
        if (topicPrefs.length > 0 && !topicPrefs[0].enabled) {
          console.log(`[CRON] Skipping user ${userId} - weekly reports disabled`);
          continue;
        }
        
        console.log(`[CRON] Sending weekly report to user ${userId} (${email})`);
        await sendWeeklyReport(userId, email);
        sent++;
      } catch (error) {
        console.error(`[CRON] Failed to send weekly report to user ${userId}:`, error);
        // Continue with next user
      }
    }
    
    console.log(`[CRON] Weekly reports job completed. Sent: ${sent} emails`);
    
    res.json({ 
      success: true,
      sent,
      total: users.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CRON] Weekly reports job failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default r;