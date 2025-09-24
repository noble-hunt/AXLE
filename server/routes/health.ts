import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, AuthenticatedRequest, AdminRequest } from '../middleware/auth';
import { db } from '../db';
import { wearableConnections, wearableTokens, healthReports, profiles, workouts } from '../../shared/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { seal, open } from '../lib/crypto';
import { storeEncryptedTokens, getDecryptedTokens, deleteTokens } from '../dal/tokens';
import { getProviderRegistry, listAvailableProviders } from '../providers/health';
import { backfillDailies, backfillSleeps, backfillHRV } from '../providers/health/garminBackfill';
import { computeDailyMetrics } from '../services/metrics/index';
import { MetricsEnvelope } from '@shared/health/types';
import { computeAxleScores } from '../metrics/axle';
import { upsertDailyReport } from '../dal/reports';
import { getEnvironment } from '../services/environment';
import { computeFatigue } from '../logic/suggestions';

const router = Router();

// GET /api/connect/providers → list providers with { id, supported: boolean, connected, last_sync, status }
router.get('/connect/providers', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;

    // Get user's current connections
    const connections = await db
      .select()
      .from(wearableConnections)
      .where(eq(wearableConnections.userId, userId));

    // Get available providers from registry
    const providers = getProviderRegistry();
    const providerList = Object.values(providers).map(provider => {
      const connection = connections.find(c => c.provider === provider.id);
      
      return {
        id: provider.id,
        supported: provider.hasConfig(),
        connected: connection?.connected || false,
        last_sync: connection?.lastSync || null,
        status: connection?.status || 'disconnected',
        error: connection?.error || null,
      };
    });

    res.json(providerList);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ message: 'Failed to fetch providers' });
  }
});

// POST /api/connect/:provider/start → if provider Mock, immediately create/update wearable_connections as connected; if real provider with config, return {redirectUrl} to OAuth
router.post('/connect/:provider/start', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { provider: providerName } = req.params;

    const providers = getProviderRegistry();
    const provider = providers[providerName];
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (!provider.hasConfig()) {
      return res.status(400).json({ message: 'Provider not configured' });
    }

    if (provider.id === 'Mock') {
      // For Mock provider, store encrypted tokens and mark as connected
      if (provider.authCallback) {
        await provider.authCallback({}, userId);
      }
      
      // Check if connection already exists
      const existingConnection = await db
        .select()
        .from(wearableConnections)
        .where(and(
          eq(wearableConnections.userId, userId),
          eq(wearableConnections.provider, provider.id)
        ))
        .limit(1);

      if (existingConnection[0]) {
        // Update existing connection
        await db
          .update(wearableConnections)
          .set({
            connected: true,
            status: 'connected',
            lastSync: new Date(),
            error: null,
          })
          .where(and(
            eq(wearableConnections.userId, userId),
            eq(wearableConnections.provider, provider.id)
          ));
      } else {
        // Insert new connection
        await db
          .insert(wearableConnections)
          .values({
            userId,
            provider: provider.id,
            connected: true,
            status: 'connected',
            lastSync: new Date(),
          });
      }

      return res.json({ success: true, connected: true });
    } else {
      // For real providers, initiate OAuth flow
      if (!provider.authStart) {
        return res.status(500).json({ message: 'Provider does not support authentication' });
      }

      console.log(`[${providerName}] authStart: Starting auth for provider ${providerName}, user ${userId}`);
      const { redirectUrl } = await provider.authStart(userId);
      console.log(`[${providerName}] authStart: Generated redirect URL for ${providerName}`);
      return res.json({ redirectUrl });
    }
  } catch (error) {
    const reqId = (req as any).id || 'unknown';
    console.error(`[${reqId}] Error starting provider connection:`, error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Failed to start provider connection' });
  }
});

// GET /api/connect/:provider/callback → handle OAuth (for Mock, just connect)
router.get('/connect/:provider/callback', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { provider: providerName } = req.params;

    // Allowlist redirect paths for security
    const allowedCallbacks = ['Mock', 'Fitbit', 'Whoop', 'Oura', 'Garmin', 'AppleHealth'];
    if (!allowedCallbacks.includes(providerName)) {
      return res.status(400).json({ message: 'Invalid callback provider' });
    }

    const providers = getProviderRegistry();
    const provider = providers[providerName];
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    // Security check: fail with 400 if provider not configured
    if (!provider.hasConfig()) {
      return res.status(400).json({ message: 'Provider not configured' });
    }

    if (provider.id === 'Mock') {
      // Mock provider doesn't need OAuth callback
      return res.json({ success: true });
    }

    if (!provider.authCallback) {
      return res.status(500).json({ message: 'Provider does not support OAuth callback' });
    }

    // Handle OAuth callback for real providers
    console.log(`[${providerName}] callback: Processing callback for provider ${providerName}, user ${userId}`);
    await provider.authCallback(req.query as Record<string, string>, userId);
    console.log(`[${providerName}] callback: Successfully processed callback for ${providerName}`);
    
    // Mark provider as connected after successful callback
    await db
      .update(wearableConnections)
      .set({
        connected: true,
        status: 'connected',
        lastSync: new Date(),
        error: null,
      })
      .where(and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, provider.id)
      ));
    
    res.json({ success: true });
  } catch (error) {
    const reqId = (req as any).id || 'unknown';
    console.error(`[${reqId}] Error handling provider callback:`, error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Failed to handle provider callback' });
  }
});

// POST /api/connect/:provider/disconnect → revoke provider tokens and mark as disconnected
router.post('/connect/:provider/disconnect', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { provider: providerName } = req.params;

    const providers = getProviderRegistry();
    const provider = providers[providerName];
    if (!provider) {
      return res.status(404).json({ error: 'Unknown provider' });
    }

    // Call revoke method if available
    if ('revoke' in provider && typeof (provider as any).revoke === 'function') {
      await (provider as any).revoke(userId);
    } else {
      // If no revoke method, just delete tokens and update connection
      await deleteTokens(userId, providerName);
      
      // Mark as disconnected in database
      await db
        .update(wearableConnections)
        .set({
          connected: false,
          status: 'disconnected',
          error: null,
        })
        .where(and(
          eq(wearableConnections.userId, userId),
          eq(wearableConnections.provider, providerName)
        ));
    }

    return res.json({ success: true });
  } catch (error) {
    const reqId = (req as any).id || 'unknown';
    console.error(`[${reqId}] Error disconnecting provider:`, error instanceof Error ? error.message : error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'disconnect failed' });
  }
});

// POST /api/health/sync (body { provider }) → fetchLatest → upsert health_reports row for today (merge metrics) and update wearable_connections.last_sync
router.post('/health/sync', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = z.object({
      provider: z.string(),
    });
    
    const { provider: providerName } = bodySchema.parse(req.body);

    const providers = getProviderRegistry();
    const provider = providers[providerName];
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (!provider.fetchLatest) {
      return res.status(500).json({ message: 'Provider does not support data fetching' });
    }

    // Check if provider is connected
    const connection = await db
      .select()
      .from(wearableConnections)
      .where(and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, providerName)
      ))
      .limit(1);

    if (!connection[0] || !connection[0].connected) {
      return res.status(400).json({ message: 'Provider not connected' });
    }

    // Fetch latest data from provider
    console.log(`[WHOOP] fetchLatest: Syncing data for provider ${providerName}, user ${userId}`);
    const healthSnapshot = await provider.fetchLatest(userId);
    console.log(`[WHOOP] fetchLatest: Completed sync for ${providerName}`, { snapshot: !!healthSnapshot });
    
    // Upsert health report for today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if report already exists for today
    const existingReport = await db
      .select()
      .from(healthReports)
      .where(and(
        eq(healthReports.userId, userId),
        eq(healthReports.date, today)
      ))
      .limit(1);

    // Get user location consent and cached coordinates for environmental data
    let weatherData = undefined;
    try {
      const profileResult = await db.execute(sql`
        SELECT location_opt_in, last_lat, last_lon 
        FROM profiles 
        WHERE user_id = ${userId}
      `);
      const profile = profileResult.rows;
      
      if (profile[0]?.location_opt_in && profile[0]?.last_lat && profile[0]?.last_lon) {
        console.log(`🌍 [SYNC] Fetching environmental data for user ${userId}`);
        const lat = Number(profile[0].last_lat);
        const lon = Number(profile[0].last_lon);
        const envData = await getEnvironment(lat, lon, today);
        weatherData = {
          lat: lat,
          lon: lon,
          tz: envData.location?.lat ? 'UTC' : undefined,
          sunrise: envData.solar.sunrise || undefined,
          sunset: envData.solar.sunset || undefined,
          uv_index: envData.weather.uvIndex,
          aqi: envData.aqi.overallIndex,
          temp_c: envData.weather.temperature
        };
      }
    } catch (error) {
      console.warn(`⚠️ [SYNC] Failed to fetch environmental data for user ${userId}:`, error);
    }

    // Calculate fatigue score for the new data
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
      id: '',
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
    console.log(`🧠 [SYNC] Computing Axle scores for user ${userId}`);
    envelope.axle = await computeAxleScores({ 
      userId, 
      dateISO: today, 
      metrics: envelope 
    });
    
    console.log(`✨ [SYNC] Computed Axle scores: Health ${envelope.axle.axle_health_score}/100, Vitality ${envelope.axle.vitality_score}/100`);
    
    // Upsert health report with complete metrics envelope
    await upsertDailyReport(userId, today, envelope);

    // Update last sync time
    await db
      .update(wearableConnections)
      .set({
        lastSync: new Date(),
        status: 'connected',
        error: null,
      })
      .where(and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, providerName)
      ));

    res.json({ 
      success: true, 
      data: healthSnapshot,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing health data:', error);
    
    // Update connection status to error
    try {
      const { provider: providerName } = req.body;
      if (providerName) {
        await db
          .update(wearableConnections)
          .set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(and(
            eq(wearableConnections.userId, (req as AuthenticatedRequest).user.id),
            eq(wearableConnections.provider, providerName)
          ));
      }
    } catch (updateError) {
      console.error('Error updating connection status:', updateError);
    }

    res.status(500).json({ message: 'Failed to sync health data' });
  }
});

// GET /api/health/reports?days=14 → list recent reports (metrics json)
router.get('/health/reports', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const daysParam = req.query.days ? parseInt(req.query.days as string) : 14;
    const days = Math.max(1, Math.min(365, daysParam)); // Clamp between 1 and 365 days
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const reports = await db
      .select()
      .from(healthReports)
      .where(and(
        eq(healthReports.userId, userId),
        // Note: In a real implementation, you'd want to add proper date filtering
        // For now, we'll get all reports and filter in memory
      ))
      .orderBy(desc(healthReports.date))
      .limit(days);

    res.json(reports);
  } catch (error) {
    console.error('Error fetching health reports:', error);
    res.status(500).json({ message: 'Failed to fetch health reports' });
  }
});

// GET /api/admin/whoop/ping → admin debug endpoint for WHOOP config
router.get('/admin/whoop/ping', requireAdmin, async (req, res) => {
  try {
    const providers = getProviderRegistry();
    const whoopProvider = providers['Whoop'];
    
    if (!whoopProvider) {
      return res.status(404).json({ 
        ok: false, 
        error: 'WHOOP provider not found',
        redirectUri: null,
        scopes: null
      });
    }

    const hasConfig = whoopProvider.hasConfig();
    const redirectUri = hasConfig ? 
      `${process.env.SITE_URL || process.env.VITE_SITE_URL}/api/connect/Whoop/callback` : 
      null;
    const scopes = hasConfig ? 
      'read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout' : 
      null;

    console.log(`[WHOOP] Admin ping: hasConfig=${hasConfig}, redirectUri=${redirectUri}`);

    res.json({
      ok: hasConfig,
      redirectUri,
      scopes,
      environment: {
        has_client_id: !!(process.env.WHOOP_CLIENT_ID),
        has_client_secret: !!(process.env.WHOOP_CLIENT_SECRET),
        has_site_url: !!(process.env.SITE_URL || process.env.VITE_SITE_URL)
      }
    });
  } catch (error) {
    console.error('[WHOOP] Admin ping error:', error);
    res.status(500).json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      redirectUri: null,
      scopes: null
    });
  }
});

// DEV ONLY: Test Garmin backfill functions
if (process.env.NODE_ENV !== 'production') {
  router.get('/dev/garmin/test-backfill', requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      
      // Get Garmin tokens for the user
      const tokens = await getDecryptedTokens(userId, 'Garmin');
      if (!tokens) {
        return res.status(400).json({ 
          error: 'No Garmin tokens found. Connect Garmin first.',
          available: false
        });
      }
      
      // Test time range: last 2 days
      const end = Math.floor(Date.now() / 1000);
      const start = end - 2 * 86400;
      
      console.log(`[DEV] Testing Garmin backfill for user ${userId}, range: ${start} to ${end}`);
      
      // Test all backfill functions
      const results: any = {
        timeRange: { start, end },
        tests: {}
      };
      
      try {
        console.log('[DEV] Testing backfillDailies...');
        const dailies = await backfillDailies(tokens.accessToken, start, end);
        results.tests.dailies = { 
          success: true, 
          count: Array.isArray(dailies) ? dailies.length : 0,
          sample: Array.isArray(dailies) && dailies.length > 0 ? dailies[0] : null
        };
      } catch (error) {
        results.tests.dailies = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
      try {
        console.log('[DEV] Testing backfillSleeps...');
        const sleeps = await backfillSleeps(tokens.accessToken, start, end);
        results.tests.sleeps = { 
          success: true, 
          count: Array.isArray(sleeps) ? sleeps.length : 0,
          sample: Array.isArray(sleeps) && sleeps.length > 0 ? sleeps[0] : null
        };
      } catch (error) {
        results.tests.sleeps = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
      try {
        console.log('[DEV] Testing backfillHRV...');
        const hrv = await backfillHRV(tokens.accessToken, start, end);
        results.tests.hrv = { 
          success: true, 
          count: Array.isArray(hrv) ? hrv.length : 0,
          sample: Array.isArray(hrv) && hrv.length > 0 ? hrv[0] : null
        };
      } catch (error) {
        results.tests.hrv = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
      console.log('[DEV] Garmin backfill test results:', JSON.stringify(results, null, 2));
      
      res.json({
        message: 'Garmin backfill test completed',
        available: true,
        ...results
      });
      
    } catch (error) {
      console.error('[DEV] Garmin backfill test error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        available: false
      });
    }
  });
}

// POST /api/health/compute/daily → compute daily metrics and upsert to health_reports
router.post('/health/compute/daily', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const bodySchema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    });
    
    const { date } = bodySchema.parse(req.body);
    const targetDate = date || new Date().toISOString().split('T')[0]; // Default to today
    
    console.log(`[COMPUTE] Computing daily metrics for user ${userId}, date: ${targetDate}`);
    
    // Load user's location from profile
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    
    let userLocation: { lat: number; lon: number; timezone: string } | null = null;
    if (profile[0] && profile[0].latitude && profile[0].longitude) {
      userLocation = {
        lat: profile[0].latitude,
        lon: profile[0].longitude,
        timezone: profile[0].timezone || 'UTC',
      };
      console.log(`[COMPUTE] Using profile location: lat=${userLocation.lat}, lon=${userLocation.lon}, tz=${userLocation.timezone}`);
    } else {
      console.log(`[COMPUTE] No location data in profile, environment service will use null coordinates`);
    }
    
    // Compute daily metrics with location data if available
    const metrics = await computeDailyMetrics(userId, targetDate, userLocation);
    console.log(`[COMPUTE] Computed metrics for ${targetDate}:`, {
      vitality: metrics.vitalityScore,
      performance: metrics.performancePotentialScore,
      circadian: metrics.circadianScore,
      energy: metrics.energyBalanceScore,
    });
    
    // Check if report already exists for this date
    const existingReport = await db
      .select()
      .from(healthReports)
      .where(and(
        eq(healthReports.userId, userId),
        eq(healthReports.date, targetDate)
      ))
      .limit(1);

    const reportData = {
      // Top-level fields for baseline computation compatibility
      hrv: metrics.rawBiometrics.hrv,
      restingHR: metrics.rawBiometrics.restingHR,
      sleepScore: metrics.rawBiometrics.sleepScore,
      stress: metrics.rawBiometrics.stress,
      steps: metrics.rawBiometrics.steps,
      calories: metrics.rawBiometrics.calories,
      
      // Computed scores (top-level for easy access)
      vitalityScore: metrics.vitalityScore,
      performancePotentialScore: metrics.performancePotentialScore,
      circadianScore: metrics.circadianScore,
      energyBalanceScore: metrics.energyBalanceScore,
      
      // Structured data for advanced analysis
      rawBiometrics: metrics.rawBiometrics,
      derived: metrics.derived,
      environment: metrics.environment,
      baselines: metrics.baselines,
    };

    if (existingReport[0]) {
      // Merge with existing metrics (upsert operation)
      const currentMetrics = existingReport[0].metrics as any || {};
      const mergedMetrics = { 
        ...currentMetrics,
        ...reportData,
      };
      
      await db
        .update(healthReports)
        .set({
          metrics: mergedMetrics,
        })
        .where(and(
          eq(healthReports.userId, userId),
          eq(healthReports.date, targetDate)
        ));
        
      console.log(`[COMPUTE] Updated existing report for ${targetDate}`);
    } else {
      // Create new report
      await db
        .insert(healthReports)
        .values({
          userId,
          date: targetDate,
          metrics: reportData,
          suggestions: [],
        });
        
      console.log(`[COMPUTE] Created new report for ${targetDate}`);
    }

    res.json({
      success: true,
      date: targetDate,
      computed_at: new Date().toISOString(),
      scores: {
        vitality: metrics.vitalityScore,
        performance: metrics.performancePotentialScore,
        circadian: metrics.circadianScore,
        energy: metrics.energyBalanceScore,
      },
    });
  } catch (error) {
    console.error('[COMPUTE] Error computing daily metrics:', error);
    res.status(500).json({ 
      message: 'Failed to compute daily metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/health/compute/backfill → admin/dev endpoint to backfill N days
router.post('/health/compute/backfill', requireAdmin, async (req, res) => {
  try {
    const adminReq = req as AdminRequest;
    const userId = adminReq.user.id;
    
    const bodySchema = z.object({
      days: z.number().min(1).max(365),
    });
    
    const { days } = bodySchema.parse(req.body);
    
    console.log(`[BACKFILL] Starting backfill for ${days} days, user: ${userId}`);
    
    // Load user's location from profile (once, outside the loop)
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    
    let userLocation: { lat: number; lon: number } | null = null;
    if (profile[0] && profile[0].latitude && profile[0].longitude) {
      userLocation = {
        lat: profile[0].latitude,
        lon: profile[0].longitude,
      };
      console.log(`[BACKFILL] Using profile location: lat=${userLocation.lat}, lon=${userLocation.lon}`);
    } else {
      console.log(`[BACKFILL] No location data in profile, environment service will use null coordinates`);
    }
    
    const results = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      try {
        console.log(`[BACKFILL] Processing date: ${dateStr} (${i + 1}/${days})`);
        
        // Compute daily metrics with location data if available
        const metrics = await computeDailyMetrics(userId, dateStr, userLocation);
        
        // Check if report already exists
        const existingReport = await db
          .select()
          .from(healthReports)
          .where(and(
            eq(healthReports.userId, userId),
            eq(healthReports.date, dateStr)
          ))
          .limit(1);

        const reportData = {
          // Top-level fields for baseline computation compatibility
          hrv: metrics.rawBiometrics.hrv,
          restingHR: metrics.rawBiometrics.restingHR,
          sleepScore: metrics.rawBiometrics.sleepScore,
          stress: metrics.rawBiometrics.stress,
          steps: metrics.rawBiometrics.steps,
          calories: metrics.rawBiometrics.calories,
          
          // Computed scores (top-level for easy access)
          vitalityScore: metrics.vitalityScore,
          performancePotentialScore: metrics.performancePotentialScore,
          circadianScore: metrics.circadianScore,
          energyBalanceScore: metrics.energyBalanceScore,
          
          // Structured data for advanced analysis
          rawBiometrics: metrics.rawBiometrics,
          derived: metrics.derived,
          environment: metrics.environment,
          baselines: metrics.baselines,
        };

        if (existingReport[0]) {
          // Update existing report
          const currentMetrics = existingReport[0].metrics as any || {};
          const mergedMetrics = { 
            ...currentMetrics,
            ...reportData,
          };
          
          await db
            .update(healthReports)
            .set({
              metrics: mergedMetrics,
            })
            .where(and(
              eq(healthReports.userId, userId),
              eq(healthReports.date, dateStr)
            ));
        } else {
          // Create new report
          await db
            .insert(healthReports)
            .values({
              userId,
              date: dateStr,
              metrics: reportData,
              suggestions: [],
            });
        }
        
        results.push({
          date: dateStr,
          success: true,
          scores: {
            vitality: metrics.vitalityScore,
            performance: metrics.performancePotentialScore,
            circadian: metrics.circadianScore,
            energy: metrics.energyBalanceScore,
          },
        });
        
      } catch (error) {
        console.error(`[BACKFILL] Error processing ${dateStr}:`, error);
        results.push({
          date: dateStr,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[BACKFILL] Completed: ${successCount}/${days} successful`);

    res.json({
      success: true,
      processed: days,
      successful: successCount,
      failed: days - successCount,
      results,
      backfilled_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[BACKFILL] Error during backfill:', error);
    res.status(500).json({ 
      message: 'Failed to backfill metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;