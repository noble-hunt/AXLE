import * as cron from "node-cron";
import { db } from "../db";
import { workouts, suggestedWorkouts, wearableConnections, healthReports } from "@shared/schema";
import { sql, eq, and, gte, desc } from "drizzle-orm";
import { computeSuggestion, computeFatigue } from "../logic/suggestions";
import { MockHealthProvider } from "../providers/health/mock";
import { FitbitHealthProvider } from "../providers/health/fitbit";
import { OuraHealthProvider } from "../providers/health/oura";
import { WhoopHealthProvider } from "../providers/health/whoop";
import { GarminHealthProvider } from "../providers/health/garmin";
import { HealthProvider } from "../providers/health/types";
import { MetricsEnvelope } from "@shared/health/types";
import { computeAxleScores } from "../metrics/axle";
import { upsertDailyReport } from "../dal/reports";
import { getEnvironment } from "../services/environment";

/**
 * Last run timestamp for health reporting
 */
let lastRunAt: Date | null = null;

// Initialize providers
const providers: Record<string, HealthProvider> = {
  Mock: new MockHealthProvider(),
  Fitbit: new FitbitHealthProvider(),
  Oura: new OuraHealthProvider(),
  Whoop: new WhoopHealthProvider(),
  Garmin: new GarminHealthProvider(),
};

/**
 * Sync health data for a user if they have connected devices and no report for today
 */
async function syncHealthDataIfNeeded(userId: string, today: string): Promise<void> {
  // Check if user has connected health devices
  const connectedDevices = await db
    .select()
    .from(wearableConnections)
    .where(and(
      eq(wearableConnections.userId, userId),
      eq(wearableConnections.connected, true)
    ));

  if (connectedDevices.length === 0) {
    return; // No connected devices, skip health sync
  }

  // Check if health report exists for today
  const existingReport = await db
    .select()
    .from(healthReports)
    .where(and(
      eq(healthReports.userId, userId),
      eq(healthReports.date, today)
    ))
    .limit(1);

  if (existingReport.length > 0) {
    return; // Already has health report for today
  }

  console.log(`🔄 [CRON] Syncing health data for user ${userId} before computing suggestion`);

  // Try to fetch health data from connected providers
  for (const device of connectedDevices) {
    const provider = providers[device.provider];
    if (!provider || !provider.fetchLatest) {
      continue;
    }

    try {
      console.log(`📊 [CRON] Fetching health data from ${device.provider} for user ${userId}`);
      const healthSnapshot = await provider.fetchLatest(userId);
      
      // Fetch last 14 days of workouts for fatigue calculation
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const last14Workouts = await db
        .select()
        .from(workouts)
        .where(and(
          eq(workouts.userId, userId),
          gte(workouts.createdAt, fourteenDaysAgo)
        ))
        .orderBy(desc(workouts.createdAt));

      // Create temporary health report object for fatigue calculation
      const tempHealthReport = {
        id: '', // Not needed for calculation
        userId: userId,
        date: today,
        metrics: {
          hrv: healthSnapshot.hrv,
          restingHR: healthSnapshot.restingHR,
          sleepScore: healthSnapshot.sleepScore,
          stress: healthSnapshot.stress,
          steps: healthSnapshot.steps,
          calories: healthSnapshot.calories,
        },
        summary: null,
        suggestions: [],
        fatigueScore: null
      };

      // Calculate fatigue score
      const rulesApplied: string[] = [];
      const fatigueScore = computeFatigue(tempHealthReport, last14Workouts, rulesApplied);
      
      console.log(`🧮 [CRON] Calculated fatigue score ${fatigueScore.toFixed(2)} for user ${userId}`);
      if (rulesApplied.length > 0) {
        console.log(`📋 [CRON] Fatigue rules applied: ${rulesApplied.join(', ')}`);
      }

      // Get user location consent and cached coordinates for environmental data
      let weatherData = undefined;
      try {
        const profileResult = await db.execute(sql`
          SELECT last_lat, last_lon 
          FROM profiles 
          WHERE user_id = ${userId}
        `);
        const profile = profileResult.rows;
        
        if (false && profile[0]?.last_lat && profile[0]?.last_lon) { // Temporarily disabled until schema is updated
          console.log(`🌍 [CRON] Fetching environmental data for user ${userId}`);
          const lat = Number(profile[0].last_lat);
          const lon = Number(profile[0].last_lon);
          const envData = await getEnvironment(lat, lon, today);
          weatherData = {
            lat: lat,
            lon: lon,
            tz: envData.location?.lat ? 'UTC' : undefined, // TODO: get actual timezone
            sunrise: envData.solar.sunrise || undefined,
            sunset: envData.solar.sunset || undefined,
            uv_index: envData.weather.uvIndex,
            aqi: envData.aqi.overallIndex,
            temp_c: envData.weather.temperature
          };
        }
      } catch (error) {
        console.warn(`⚠️ [CRON] Failed to fetch environmental data for user ${userId}:`, error);
      }
      
      // Create MetricsEnvelope with provider metrics
      const envelope: MetricsEnvelope = {
        provider: {
          hrv: healthSnapshot.hrv,
          resting_hr: healthSnapshot.restingHR,
          sleep_score: healthSnapshot.sleepScore,
          fatigue_score: fatigueScore,
        },
        weather: weatherData,
        axle: {}, // Will be filled by computeAxleScores
      };

      // Compute proprietary Axle scores
      console.log(`🧠 [CRON] Computing Axle scores for user ${userId}`);
      envelope.axle = await computeAxleScores({ 
        userId, 
        dateISO: today, 
        metrics: envelope 
      });
      
      console.log(`✨ [CRON] Computed Axle scores: Health ${envelope.axle.axle_health_score}/100, Vitality ${envelope.axle.vitality_score}/100`);
      
      // Upsert health report with complete metrics envelope
      await upsertDailyReport(userId, today, envelope);

      console.log(`✅ [CRON] Created health report from ${device.provider} for user ${userId}`);
      
      // Update connection last sync time
      await db
        .update(wearableConnections)
        .set({ 
          lastSync: new Date(),
          status: 'connected'
        } as any)
        .where(and(
          eq(wearableConnections.userId, userId),
          eq(wearableConnections.provider, device.provider)
        ));
      
      break; // Successfully synced from one provider, that's enough
      
    } catch (error) {
      console.error(`❌ [CRON] Failed to sync health data from ${device.provider} for user ${userId}:`, error);
      
      // Update connection with error status
      await db
        .update(wearableConnections)
        .set({ 
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        } as any)
        .where(and(
          eq(wearableConnections.userId, userId),
          eq(wearableConnections.provider, device.provider)
        ));
    }
  }
}

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
        
        // Sync health data if needed before computing suggestion
        await syncHealthDataIfNeeded(userId, today);

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
            } as any)
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