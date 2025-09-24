// server/providers/health/whoop.ts
import type { HealthProvider } from "./types";
import { verifyState, signState } from '../../lib/oauthState';
import { 
  storeEncryptedTokens, 
  getDecryptedTokens, 
  deleteTokens 
} from "../../dal/tokens";
import { upsertWearable } from "../../dal/wearables";
import { subDays, format } from "date-fns";

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

async function authedFetch(userId: string, input: RequestInfo, init?: RequestInit) {
  let tok = await getDecryptedTokens(userId, "Whoop");
  if (!tok) throw new Error("No WHOOP token on file");
  
  let res = await fetch(input, {
    ...(init || {}),
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${tok.accessToken}` },
  });
  
  if (res.status === 401 && tok.refreshToken) {
    const refreshed = await tokenRefresh(tok.refreshToken);
    const expiresAt = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : undefined;
    await storeEncryptedTokens(userId, "Whoop", {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? tok.refreshToken,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    res = await fetch(input, {
      ...(init || {}),
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${refreshed.access_token}` },
    });
  }
  return res;
}

export class WhoopHealthProvider implements HealthProvider {
  id: HealthProvider['id'] = "Whoop";

  hasConfig() {
    return hasConfigEnv();
  }

  async authStart(userId: string) {
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
    return { redirectUrl: url.toString() };
  }

  async authCallback(params: Record<string, string>) {
    const { code, state } = params;
    if (!code || !state) throw new Error('Missing code/state');
    const { userId } = verifyState(state);
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
  }

  async fetchLatest(userId: string) {
    const end = new Date();
    const start = subDays(end, 2);

    // 1) Recent cycles (day windows)
    const cyclesRes = await authedFetch(
      userId,
      `${WHOOP_API}/cycle?limit=5&start=${start.toISOString()}&end=${end.toISOString()}`
    );
    if (!cyclesRes.ok) throw new Error(`WHOOP cycles error: ${cyclesRes.status}`);
    const cycles = await cyclesRes.json(); // { records: [...] }
    const latestCycle = cycles?.records?.[0];

    // 2) Recovery (collection)
    const recRes = await authedFetch(
      userId,
      `${WHOOP_API}/recovery?limit=5&start=${start.toISOString()}&end=${end.toISOString()}`
    );
    const recData = recRes.ok ? await recRes.json() : { records: [] };
    const latestRecovery = recData.records?.[0];

    // 3) Sleep (collection)
    const sleepRes = await authedFetch(
      userId,
      `${WHOOP_API}/sleep?limit=5&start=${start.toISOString()}&end=${end.toISOString()}`
    );
    const sleepData = sleepRes.ok ? await sleepRes.json() : { records: [] };
    const latestSleep = sleepData.records?.[0];

    // 4) Workouts (collection) – optional enrichment
    const wRes = await authedFetch(
      userId,
      `${WHOOP_API}/workout?limit=1&start=${start.toISOString()}&end=${end.toISOString()}`
    );
    const workouts = wRes.ok ? await wRes.json() : { records: [] };

    // Map into standardized health snapshot format
    const snapshot = {
      provider: "Whoop",
      date: format(end, 'yyyy-MM-dd'),
      hrv_ms: latestRecovery?.score?.hrv_rmssd_milli || latestRecovery?.hrv_rmssd_milli || null,
      resting_hr_bpm: latestRecovery?.score?.resting_heart_rate || latestRecovery?.resting_heart_rate || null,
      sleep_score: latestSleep?.score?.sleep_performance_percentage || null,
      steps: null, // WHOOP doesn't track steps directly
      calories: latestCycle?.score?.kilojoule ? Math.round(latestCycle.score.kilojoule / 4.184) : null,
      stress_0_10: null, // WHOOP uses strain instead of traditional stress
      raw: {
        cycle: latestCycle || null,
        recovery: latestRecovery || null,
        sleep: latestSleep || null,
        workouts: workouts.records || [],
      },
    };

    await upsertWearable({
      userId,
      provider: "Whoop",
      connected: true,
      lastSync: new Date().toISOString()
    });

    return snapshot;
  }

  async disconnect(userId: string) {
    try {
      await deleteTokens(userId, "Whoop");
      await upsertWearable({
        userId,
        provider: "Whoop",
        connected: false,
        lastSync: null
      });
      return { success: true };
    } catch (error) {
      console.error('WHOOP disconnect error:', error);
      await upsertWearable({
        userId,
        provider: "Whoop",
        connected: false,
        lastSync: null
      });
      throw error;
    }
  }

  canRevoke() {
    return false; // WHOOP doesn't provide a revoke endpoint
  }
}

export default WhoopHealthProvider;