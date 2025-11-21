// server/providers/health/whoop.ts
import type { HealthProvider } from "./types.js";
import { verifyState, signState } from '../../lib/oauthState.js';
import { 
  storeEncryptedTokens, 
  getDecryptedTokens, 
  deleteTokens 
} from "../../dal/tokens.js";
import { upsertWearable } from "../../dal/wearables.js";
import { subDays, format, subMinutes } from "date-fns";
import { toSnapshot, createNullSnapshot } from "../whoop/map.js";
import { db } from "../../db.js";
import { wearableConnections } from "../../../shared/schema.js";
import { eq, and } from "drizzle-orm";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API = "https://api.prod.whoop.com/developer/v2";

function siteUrl() {
  // Prefer server-side SITE_URL; fall back to Vercel URL or VITE_SITE_URL
  return (
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.VITE_SITE_URL)
  );
}

function redirectUri() {
  return `${siteUrl()}/api/connect/Whoop/callback`;
}

function hasConfigEnv() {
  return !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
}

async function tokenExchange(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
  });
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`WHOOP token exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}

async function tokenRefresh(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
  });
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`WHOOP token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}

async function authedFetch(userId: string, input: any, init?: RequestInit): Promise<{ response: Response; tokenRefreshed: boolean }> {
  let tok = await getDecryptedTokens(userId, "Whoop");
  if (!tok) throw new Error("No WHOOP token on file");
  
  let res = await fetch(input, {
    ...(init || {}),
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${tok.accessToken}` },
  });
  
  let tokenRefreshed = false;
  
  // Handle 401 with token refresh and retry once
  if (res.status === 401 && tok.refreshToken) {
    try {
      const refreshed = await tokenRefresh(tok.refreshToken);
      const expiresAt = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : undefined;
      await storeEncryptedTokens(userId, "Whoop", {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? tok.refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      
      // Retry the request with new token
      res = await fetch(input, {
        ...(init || {}),
        headers: { ...(init?.headers || {}), Authorization: `Bearer ${refreshed.access_token}` },
      });
      tokenRefreshed = true;
    } catch (refreshError) {
      // Token refresh failed - update wearable connection with error
      await upsertWearable({
        userId,
        provider: "Whoop",
        connected: false,
        lastSync: null,
        error: "Session expired, please reconnect WHOOP",
        status: "error"
      });
      throw new Error("Session expired, please reconnect WHOOP");
    }
  }
  
  return { response: res, tokenRefreshed };
}

export class WhoopHealthProvider implements HealthProvider {
  id: HealthProvider['id'] = "Whoop";

  hasConfig() {
    return hasConfigEnv();
  }

  async authStart(userId: string) {
    console.log(`[WHOOP] authStart: Initiating OAuth for user ${userId}`);
    if (!hasConfigEnv()) throw new Error("WHOOP not configured");
    const scope =
      "read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout";
    const url = new URL(WHOOP_AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", process.env.WHOOP_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("scope", scope);
    // Use signed state to protect CSRF
    const state = signState({ userId, t: Date.now() });
    url.searchParams.set("state", state);
    console.log(`[WHOOP] authStart: Generated redirect URL for user ${userId}`);
    return { redirectUrl: url.toString() };
  }

  async authCallback(params: Record<string, string>) {
    console.log(`[WHOOP] callback: Processing OAuth callback with params`, { code: !!params.code, state: !!params.state });
    const { code, state } = params;
    if (!code || !state) throw new Error('Missing code/state');
    const { userId } = verifyState(state);
    console.log(`[WHOOP] callback: Verified state for user ${userId}`);
    const exchanged = await tokenExchange(code);
    const expiresAt = exchanged.expires_in ? Date.now() + exchanged.expires_in * 1000 : undefined;
    
    await storeEncryptedTokens(userId, "Whoop", {
      accessToken: exchanged.access_token,
      refreshToken: exchanged.refresh_token,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    
    await upsertWearable({ 
      userId,
      provider: "Whoop",
      connected: true, 
      lastSync: new Date().toISOString()
    });
    console.log(`[WHOOP] callback: Successfully connected user ${userId}`);
  }

  async fetchLatest(userId: string) {
    console.log(`[WHOOP] fetchLatest: Starting data fetch for user ${userId}`);
    const now = new Date();
    
    // Rate limiting: check if last sync was less than 10 minutes ago
    const connection = await db
      .select()
      .from(wearableConnections)
      .where(and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, "Whoop")
      ))
      .limit(1);
    
    const lastSync = connection[0]?.lastSync;
    if (lastSync) {
      const lastSyncDate = new Date(lastSync);
      const tenMinutesAgo = subMinutes(now, 10);
      if (lastSyncDate > tenMinutesAgo) {
        // Too recent, return cached data or null snapshot
        const nullSnapshot = createNullSnapshot(now);
        console.log(`WHOOP: Rate limit hit, last sync was ${lastSyncDate.toISOString()}`);
        return nullSnapshot;
      }
    }

    const end = now;
    const start = subDays(end, 2);
    let tokenRefreshed = false;

    try {
      // Defensive fetching with null checks for all WHOOP endpoints
      let latestCycle = null;
      let latestRecovery = null;
      let latestSleep = null;
      let workouts = { records: [] };

      // 1) Recent cycles (day windows)
      try {
        const { response: cyclesRes, tokenRefreshed: refreshed1 } = await authedFetch(
          userId,
          `${WHOOP_API}/cycle?limit=5&start=${start.toISOString()}&end=${end.toISOString()}`
        );
        tokenRefreshed = tokenRefreshed || refreshed1;
        
        if (cyclesRes.ok) {
          const cycles = await cyclesRes.json();
          latestCycle = (cycles as any)?.records?.[0] || null;
        } else {
          console.warn(`WHOOP cycles API returned ${cyclesRes.status}`);
        }
      } catch (error) {
        console.warn('WHOOP cycles fetch failed:', error);
      }

      // 2) Recovery (collection)
      try {
        const { response: recRes, tokenRefreshed: refreshed2 } = await authedFetch(
          userId,
          `${WHOOP_API}/recovery?limit=5&start=${start.toISOString()}&end=${end.toISOString()}`
        );
        tokenRefreshed = tokenRefreshed || refreshed2;
        
        if (recRes.ok) {
          const recData = await recRes.json();
          latestRecovery = (recData as any)?.records?.[0] || null;
        } else {
          console.warn(`WHOOP recovery API returned ${recRes.status}`);
        }
      } catch (error) {
        console.warn('WHOOP recovery fetch failed:', error);
      }

      // 3) Sleep (collection)
      try {
        const { response: sleepRes, tokenRefreshed: refreshed3 } = await authedFetch(
          userId,
          `${WHOOP_API}/sleep?limit=5&start=${start.toISOString()}&end=${end.toISOString()}`
        );
        tokenRefreshed = tokenRefreshed || refreshed3;
        
        if (sleepRes.ok) {
          const sleepData = await sleepRes.json();
          latestSleep = (sleepData as any)?.records?.[0] || null;
        } else {
          console.warn(`WHOOP sleep API returned ${sleepRes.status}`);
        }
      } catch (error) {
        console.warn('WHOOP sleep fetch failed:', error);
      }

      // 4) Workouts (collection) – optional enrichment
      try {
        const { response: wRes, tokenRefreshed: refreshed4 } = await authedFetch(
          userId,
          `${WHOOP_API}/workout?limit=1&start=${start.toISOString()}&end=${end.toISOString()}`
        );
        tokenRefreshed = tokenRefreshed || refreshed4;
        
        if (wRes.ok) {
          workouts = await wRes.json() as any;
        } else {
          console.warn(`WHOOP workout API returned ${wRes.status}`);
        }
      } catch (error) {
        console.warn('WHOOP workout fetch failed:', error);
      }

      // Check if we have any data from the last 2 days
      const hasData = latestCycle || latestRecovery || latestSleep || (workouts.records && workouts.records.length > 0);
      
      let snapshot;
      if (!hasData) {
        // No data available, return null snapshot but still record sync
        snapshot = createNullSnapshot(end);
        console.log('WHOOP: No data found in last 2 days, returning null snapshot');
      } else {
        // Map WHOOP data to standardized format using pure mapper
        snapshot = toSnapshot({
          cycle: latestCycle,
          recovery: latestRecovery,
          sleep: latestSleep,
          workouts: workouts.records
        }, end);
      }

      // Update wearable connection with successful sync
      await upsertWearable({
        userId,
        provider: "Whoop",
        connected: true,
        lastSync: new Date().toISOString(),
        error: null, // Clear any previous errors
        status: "connected"
      });

      console.log(`[WHOOP] fetchLatest: Successfully fetched data for user ${userId}`, { hasData });
      return snapshot;
      
    } catch (error) {
      console.error(`[WHOOP] fetchLatest: Error for user ${userId}:`, error);
      
      // For 401 errors that couldn't be refreshed, the error is already handled in authedFetch
      if ((error as Error).message?.includes('Session expired')) {
        throw error; // Re-throw to surface the "reconnect" message
      }
      
      // For other errors, update connection with error state but don't throw
      await upsertWearable({
        userId,
        provider: "Whoop",
        connected: true, // Keep connected but log error
        lastSync: new Date().toISOString(),
        error: `API Error: ${(error as Error).message}`,
        status: "error"
      });
      
      // Return null snapshot even on errors to ensure sync completes
      console.log(`[WHOOP] fetchLatest: Returning null snapshot due to error for user ${userId}`);
      return createNullSnapshot(end);
    }
  }

  async disconnect(userId: string) {
    try {
      await deleteTokens(userId, "Whoop");
      await upsertWearable({
        userId,
        provider: "Whoop",
        connected: false,
        lastSync: null,
        error: null,
        status: "disconnected"
      });
      return { success: true };
    } catch (error) {
      console.error('WHOOP disconnect error:', error);
      await upsertWearable({
        userId,
        provider: "Whoop",
        connected: false,
        lastSync: null,
        error: null,
        status: "disconnected"
      });
      throw error;
    }
  }

  canRevoke() {
    return false; // WHOOP doesn't provide a revoke endpoint
  }
}

export default WhoopHealthProvider;