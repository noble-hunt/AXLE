import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { wearableConnections, wearableTokens, healthReports } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { seal, open } from '../lib/crypto';
import { storeEncryptedTokens, getDecryptedTokens, deleteTokens } from '../dal/tokens';
import { getProviderRegistry, listAvailableProviders } from '../providers/health';

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

      const { redirectUrl } = await provider.authStart(userId);
      return res.json({ redirectUrl });
    }
  } catch (error) {
    console.error('Error starting provider connection:', error);
    res.status(500).json({ message: 'Failed to start provider connection' });
  }
});

// GET /api/connect/:provider/callback → handle OAuth (for Mock, just connect)
router.get('/connect/:provider/callback', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    const { provider: providerName } = req.params;

    const providers = getProviderRegistry();
    const provider = providers[providerName];
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (provider.id === 'Mock') {
      // Mock provider doesn't need OAuth callback
      return res.json({ success: true });
    }

    if (!provider.authCallback) {
      return res.status(500).json({ message: 'Provider does not support OAuth callback' });
    }

    // Handle OAuth callback for real providers
    await provider.authCallback(req.query as Record<string, string>, userId);
    
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
    console.error('Error handling provider callback:', error);
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
    console.error('Error disconnecting provider:', error);
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
    const healthSnapshot = await provider.fetchLatest(userId);
    
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

    if (existingReport[0]) {
      // Merge with existing metrics
      const currentMetrics = existingReport[0].metrics as any || {};
      const mergedMetrics = { ...currentMetrics };
      
      // Update with new data from snapshot
      if (healthSnapshot.hrv !== undefined) mergedMetrics.hrv = healthSnapshot.hrv;
      if (healthSnapshot.restingHR !== undefined) mergedMetrics.restingHR = healthSnapshot.restingHR;
      if (healthSnapshot.sleepScore !== undefined) mergedMetrics.sleepScore = healthSnapshot.sleepScore;
      if (healthSnapshot.stress !== undefined) mergedMetrics.stress = healthSnapshot.stress;
      if (healthSnapshot.steps !== undefined) mergedMetrics.steps = healthSnapshot.steps;
      if (healthSnapshot.calories !== undefined) mergedMetrics.calories = healthSnapshot.calories;

      await db
        .update(healthReports)
        .set({
          metrics: mergedMetrics,
        })
        .where(and(
          eq(healthReports.userId, userId),
          eq(healthReports.date, today)
        ));
    } else {
      // Create new report
      const metrics = {
        hrv: healthSnapshot.hrv,
        restingHR: healthSnapshot.restingHR,
        sleepScore: healthSnapshot.sleepScore,
        stress: healthSnapshot.stress,
        steps: healthSnapshot.steps,
        calories: healthSnapshot.calories,
      };

      await db
        .insert(healthReports)
        .values({
          userId,
          date: today,
          metrics,
          suggestions: [],
        });
    }

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

export default router;