import * as cron from "node-cron";
import { db } from "../db";
import { workouts, suggestedWorkouts } from "@shared/schema";
import { sql, eq, and, gte } from "drizzle-orm";
import { computeSuggestion } from "../logic/suggestions";

/**
 * Last run timestamp for health reporting
 */
let lastRunAt: Date | null = null;

/**
 * Generate daily suggestions for active users
 * Runs every day at 05:00 UTC
 */
export async function generateDailySuggestions(): Promise<{ processed: number; created: number; errors: number }> {
  const startTime = new Date();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  
  console.log(`🌅 [CRON] Starting daily suggestions generation for ${today}`);
  
  let processed = 0;
  let created = 0;
  let errors = 0;
  
  try {
    // Query distinct user_id from workouts updated in last 14 days
    const activeUsers = await db
      .selectDistinct({ userId: workouts.userId })
      .from(workouts)
      .where(gte(workouts.createdAt, fourteenDaysAgo));
      
    console.log(`📊 [CRON] Found ${activeUsers.length} active users from last 14 days`);
    
    for (const { userId } of activeUsers) {
      try {
        processed++;
        
        // Check if suggestion already exists for today
        const existingSuggestion = await db
          .select()
          .from(suggestedWorkouts)
          .where(and(
            eq(suggestedWorkouts.userId, userId),
            eq(suggestedWorkouts.date, today)
          ))
          .limit(1);
          
        if (existingSuggestion.length > 0) {
          console.log(`⏭️  [CRON] User ${userId} already has suggestion for ${today}, skipping`);
          continue;
        }
        
        // Generate new suggestion
        console.log(`🧠 [CRON] Generating suggestion for user ${userId}`);
        const suggestionResult = await computeSuggestion(userId, new Date());
        
        // Insert new suggestion (unique constraint handles conflicts)
        try {
          const inserted = await db
            .insert(suggestedWorkouts)
            .values({
              userId: userId,
              date: today,
              request: suggestionResult.request,
              rationale: suggestionResult.rationale,
              workoutId: null
            })
            .returning();
            
          if (inserted[0]) {
            created++;
            console.log(`✅ [CRON] Created suggestion ${inserted[0].id} for user ${userId}`);
          }
        } catch (insertError: any) {
          // Handle unique constraint conflicts gracefully
          if (insertError.code === '23505') { // PostgreSQL unique constraint violation
            console.log(`⚠️  [CRON] Suggestion already exists for user ${userId} on ${today} (concurrent insert)`);
          } else {
            throw insertError;
          }
        }
        
      } catch (userError) {
        errors++;
        console.error(`❌ [CRON] Error processing user ${userId}:`, userError);
        // Continue with next user
      }
    }
    
  } catch (globalError) {
    console.error("💥 [CRON] Critical error in daily suggestions job:", globalError);
    throw globalError;
  }
  
  const duration = Date.now() - startTime.getTime();
  lastRunAt = startTime;
  
  console.log(`🎯 [CRON] Daily suggestions completed in ${duration}ms: ${processed} processed, ${created} created, ${errors} errors`);
  
  return { processed, created, errors };
}

/**
 * Get the count of suggestions created today
 */
export async function getTodaySuggestionsCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(suggestedWorkouts)
    .where(eq(suggestedWorkouts.date, today));
    
  // Ensure we return a number, not a string
  const count = result[0]?.count || 0;
  return typeof count === 'string' ? parseInt(count, 10) : count;
}

/**
 * Get last run timestamp
 */
export function getLastRunAt(): Date | null {
  return lastRunAt;
}

/**
 * Start the cron job
 */
export function startSuggestionsCron(): void {
  // Run every day at 05:00 UTC (5 AM UTC)
  cron.schedule('0 5 * * *', async () => {
    try {
      await generateDailySuggestions();
    } catch (error) {
      console.error("🚨 [CRON] Failed to run daily suggestions job:", error);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log("⏰ [CRON] Daily suggestions job scheduled for 05:00 UTC");
}

/**
 * Get all scheduled tasks (for testing/shutdown)
 */
export function getAllTasks() {
  return cron.getTasks();
}