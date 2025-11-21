import type { HealthProvider, HealthSnapshot } from './types.js';
import { storeEncryptedTokens, getDecryptedTokens } from '../../dal/tokens.js';
import { upsertWearable } from '../../dal/wearables.js';
import { verifyState, signState } from '../../lib/oauthState.js';

const OURA_AUTH = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN = 'https://cloud.ouraring.com/oauth/token';
const OURA_API = 'https://api.ouraring.com/v2/usercollection';

const SITE = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://axle-ebon.vercel.app';
const REDIRECT = `${SITE}/api/connect/Oura/callback`;

export class OuraHealthProvider implements HealthProvider {
  id: HealthProvider['id'] = 'Oura';

  hasConfig() {
    return !!(process.env.OURA_CLIENT_ID && process.env.OURA_CLIENT_SECRET);
  }

  async authStart(userId: string) {
    if (!this.hasConfig()) throw new Error('Oura not configured');
    const state = signState({ userId, t: Date.now() });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.OURA_CLIENT_ID!,
      redirect_uri: REDIRECT,
      // Adjust scopes as needed in your Oura app config
      scope: 'daily heartrate activity sleep',
      state,
    });
    return { redirectUrl: `${OURA_AUTH}?${params.toString()}` };
  }

  async authCallback(params: Record<string, string>, userId: string) {
    const { code, state } = params;
    if (!code || !state) throw new Error('Missing code/state');
    const { userId: stateUserId } = verifyState(state);
    
    // Use userId from state for security
    const actualUserId = stateUserId || userId;

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    });

    const tokRes = await fetch(OURA_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const tokens = await tokRes.json() as any;
    if (!tokRes.ok) throw new Error(tokens?.error_description || 'token exchange failed');

    // Persist securely via existing DAL
    await storeEncryptedTokens(actualUserId, 'Oura', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      scope: tokens.scope,
    });
    
    await upsertWearable({
      userId: actualUserId,
      provider: 'Oura',
      connected: true,
      lastSync: new Date().toISOString(),
    });
  }

  async fetchLatest(userId: string): Promise<HealthSnapshot> {
    const tok = await getDecryptedTokens(userId, 'Oura');
    if (!tok?.accessToken) throw new Error('Not connected');

    const auth = { Authorization: `Bearer ${tok.accessToken}` };

    // Fetch yesterday..today to be safe across timezones
    const end = new Date(); 
    const start = new Date(end); 
    start.setDate(end.getDate() - 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const [sleepRes, activityRes] = await Promise.all([
      fetch(`${OURA_API}/daily_sleep?start_date=${fmt(start)}&end_date=${fmt(end)}`, { headers: auth }),
      fetch(`${OURA_API}/daily_activity?start_date=${fmt(start)}&end_date=${fmt(end)}`, { headers: auth }),
    ]);

    const sleepJson: any = await sleepRes.json();
    const actJson: any = await activityRes.json();

    const sleep = sleepJson?.data?.[0] || {};
    const activity = actJson?.data?.[0] || {};

    // Map to HealthSnapshot type
    return {
      date: sleep?.day || activity?.day || new Date().toISOString().slice(0, 10),
      hrv: null, // Oura's HRV requires additional endpoint; optional for MVP
      restingHR: sleep?.average_heart_rate ?? sleep?.lowest_heart_rate ?? null,
      sleepScore: sleep?.score ?? null,
      stress: null,
      steps: activity?.steps ?? null,
      calories: activity?.cal_total ?? activity?.active_calories ?? null,
    };
  }
}