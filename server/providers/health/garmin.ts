import type { HealthProvider, HealthSnapshot } from "./types";
import { garmin, isGarminConfigured } from "../../config";
import { makePkce } from "../../lib/pkce";
import { signState, verifyState } from "../../lib/oauthState";
import { storeEncryptedTokens, getDecryptedTokens } from "../../dal/tokens";
import { upsertWearable } from "../../dal/wearables";

const AUTH_URL = "https://connect.garmin.com/oauth2Confirm";
const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const USER_ID_URL = "https://apis.garmin.com/wellness-api/rest/user/id";

export class GarminHealthProvider implements HealthProvider {
  id: HealthProvider['id'] = "Garmin";

  hasConfig() {
    return isGarminConfigured();
  }

  async authStart(userId: string) {
    if (!garmin.clientId || !garmin.redirectUrl) throw new Error("Garmin not configured");
    const pkce = makePkce();
    const state = signState({ u: userId, v: pkce.code_verifier, p: "garmin" });
    const url = new URL(AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", garmin.clientId);
    url.searchParams.set("code_challenge", pkce.code_challenge);
    url.searchParams.set("code_challenge_method", pkce.method);
    url.searchParams.set("redirect_uri", garmin.redirectUrl);
    url.searchParams.set("state", state);
    return { redirectUrl: url.toString() };
  }

  async authCallback(params: Record<string, string>, userId: string) {
    const { code, state } = params;
    if (!code || !state) throw new Error("Missing code/state");
    const decoded = verifyState(state) as { u: string; v: string; p: string };
    if (decoded.p !== "garmin" || decoded.u !== userId) throw new Error("Bad state");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: garmin.clientId,
      client_secret: garmin.clientSecret,
      code,
      code_verifier: decoded.v,
      redirect_uri: garmin.redirectUrl,
    });
    
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    
    if (!res.ok) throw new Error(`Garmin token exchange failed: ${res.status}`);
    const tok = await res.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    
    // Persist tokens via existing encrypted DAL
    const expiresAt = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : undefined;
    await storeEncryptedTokens(userId, "Garmin", {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt,
      scope: tok.scope
    });
    
    await upsertWearable({ 
      userId, 
      provider: "Garmin", 
      connected: true, 
      status: "connected", 
      lastSync: new Date().toISOString(),
      error: null 
    });
  }

  async fetchLatest(userId: string): Promise<HealthSnapshot> {
    const tokens = await getDecryptedTokens(userId, "Garmin");
    if (!tokens) throw new Error("Not connected");
    
    // Ensure fresh access token
    const accessToken = await this.ensureGarminAccessToken(tokens, userId);
    
    // Get API user id (stable across tokens) - required for API calls but not used in snapshot
    const uidRes = await fetch(USER_ID_URL, { 
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!uidRes.ok) throw new Error(`Garmin user id failed: ${uidRes.status}`);
    await uidRes.json(); // Validates API access but result not needed for snapshot

    // Pull last 2 days daily summary via backfill (Health API)
    const end = Math.floor(Date.now() / 1000);
    const start = end - 2 * 86400;
    const dailiesUrl = new URL("https://apis.garmin.com/wellness-api/rest/backfill/dailies");
    dailiesUrl.searchParams.set("summaryStartTimeInSeconds", String(start));
    dailiesUrl.searchParams.set("summaryEndTimeInSeconds", String(end));
    
    const dailiesRes = await fetch(dailiesUrl, { 
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!dailiesRes.ok) throw new Error(`Garmin dailies failed: ${dailiesRes.status}`);
    const dailies = await dailiesRes.json() as unknown[];

    // Map to HealthSnapshot with resilient field guards
    const latest = Array.isArray(dailies) && dailies.length ? dailies[dailies.length - 1] as Record<string, unknown> : null;
    
    // Helper function to safely extract numeric values
    const safeNumber = (value: unknown): number | null => {
      if (typeof value === 'number' && !isNaN(value)) return value;
      return null;
    };
    
    // Helper function to safely extract nested values
    const safeNested = (obj: unknown, key: string): unknown => {
      if (obj && typeof obj === 'object' && key in obj) {
        return (obj as Record<string, unknown>)[key];
      }
      return null;
    };

    const snapshot: HealthSnapshot = {
      date: (typeof latest?.calendarDate === 'string') ? latest.calendarDate : new Date().toISOString().slice(0, 10),
      hrv: safeNumber(safeNested(latest?.hrvSummary, 'avgRmssd')),
      restingHR: safeNumber(latest?.restingHeartRate),
      sleepScore: (() => {
        const sleepDuration = safeNumber(latest?.sleepDurationInSeconds);
        if (sleepDuration === null) return null;
        // Convert sleep duration to a 0-100 score (8 hours = 100%)
        return Math.round(Math.min(100, (sleepDuration / 28800) * 100));
      })(),
      stress: safeNumber(latest?.stressLevel),
      steps: safeNumber(latest?.steps),
      calories: safeNumber(latest?.calories),
      raw: latest ? { garminDaily: latest } : undefined,
    };
    
    // Update last sync time
    await upsertWearable({
      userId,
      provider: "Garmin",
      connected: true,
      status: "connected",
      lastSync: new Date().toISOString(),
      error: null
    });
    
    return snapshot;
  }

  // Token refresh helper
  private async ensureGarminAccessToken(tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }, userId: string): Promise<string> {
    const now = Date.now() / 1000;
    const expiresAt = tokens.expiresAt ? new Date(tokens.expiresAt).getTime() / 1000 : 0;
    const bufferTime = 600; // refresh 10 min early
    
    if (now < (expiresAt - bufferTime) && tokens.accessToken) {
      return tokens.accessToken;
    }

    if (!tokens.refreshToken) {
      throw new Error("No refresh token available");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: garmin.clientId,
      client_secret: garmin.clientSecret,
      refresh_token: tokens.refreshToken,
    });
    
    const res = await fetch(TOKEN_URL, { 
      method: "POST", 
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, 
      body 
    });
    
    if (!res.ok) throw new Error(`Garmin refresh failed: ${res.status}`);
    const refreshed = await res.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    
    const newExpiresAt = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : undefined;
    await storeEncryptedTokens(userId, "Garmin", {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || tokens.refreshToken,
      expiresAt: newExpiresAt,
      scope: refreshed.scope
    });
    
    return refreshed.access_token;
  }
}