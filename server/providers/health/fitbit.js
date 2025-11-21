import { verifyState, signState } from '../../lib/oauthState.js';
import { storeEncryptedTokens, getDecryptedTokens, deleteTokens, } from '../../dal/tokens.js';
import { upsertWearable } from '../../dal/wearables.js';
const FITBIT_AUTH = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN = 'https://api.fitbit.com/oauth2/token';
const FITBIT_REVOKE = 'https://api.fitbit.com/oauth2/revoke';
const FITBIT_API = 'https://api.fitbit.com';
const SITE = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://axle-ebon.vercel.app';
const REDIRECT = `${SITE}/api/connect/Fitbit/callback`;
// Minimal scopes to get activity, heart rate, sleep & profile
const SCOPES = [
    'activity', // steps, calories
    'heartrate', // resting HR
    'sleep', // sleep + (score in v1.2 endpoints)
    'profile'
].join(' ');
export class FitbitHealthProvider {
    constructor() {
        this.id = 'Fitbit';
    }
    hasConfig() {
        return !!(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET);
    }
    async authStart(userId) {
        if (!this.hasConfig())
            throw new Error('Fitbit not configured');
        const state = signState({ userId, t: Date.now() });
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: process.env.FITBIT_CLIENT_ID,
            redirect_uri: REDIRECT,
            scope: SCOPES,
            state,
            // Fitbit recommends PKCE for public apps; for MVP we use confidential client on server
        });
        return { redirectUrl: `${FITBIT_AUTH}?${params.toString()}` };
    }
    async authCallback(params) {
        const { code, state } = params;
        if (!code || !state)
            throw new Error('Missing code/state');
        const { userId } = verifyState(state);
        const body = new URLSearchParams({
            client_id: process.env.FITBIT_CLIENT_ID,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT,
            code,
        }).toString();
        const tokenRes = await fetch(FITBIT_TOKEN, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                // Fitbit uses Basic auth with client creds on token endpoint
                Authorization: 'Basic ' +
                    Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64'),
            },
            body,
        });
        const tokens = await tokenRes.json();
        if (!tokenRes.ok)
            throw new Error(tokens?.errors?.[0]?.message || 'token exchange failed');
        await storeEncryptedTokens(userId, 'Fitbit', {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
            scope: tokens.scope,
        });
        await upsertWearable({
            userId,
            provider: 'Fitbit',
            connected: true,
            lastSync: null
        });
    }
    async ensureToken(userId) {
        const t = await getDecryptedTokens(userId, 'Fitbit');
        if (!t?.accessToken)
            throw new Error('Not connected');
        // Refresh if close to expiry (within 2 min)
        if (t.expiresAt && Date.now() > t.expiresAt.getTime() - 120000 && t.refreshToken) {
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: t.refreshToken,
            }).toString();
            const res = await fetch(FITBIT_TOKEN, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    Authorization: 'Basic ' +
                        Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64'),
                },
                body,
            });
            const j = await res.json();
            if (res.ok) {
                await storeEncryptedTokens(userId, 'Fitbit', {
                    accessToken: j.access_token,
                    refreshToken: j.refresh_token ?? t.refreshToken,
                    expiresAt: j.expires_in ? new Date(Date.now() + j.expires_in * 1000) : t.expiresAt,
                    scope: j.scope ?? t.scope,
                });
                return j.access_token;
            }
            // if refresh fails, fall through and try with old token (may 401)
        }
        return t.accessToken;
    }
    async fetchLatest(userId) {
        const access = await this.ensureToken(userId);
        const auth = { Authorization: `Bearer ${access}` };
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const d = `${yyyy}-${mm}-${dd}`;
        // Activity (steps, calories)
        const actRes = await fetch(`${FITBIT_API}/1/user/-/activities/date/${d}.json`, { headers: auth });
        const act = await actRes.json();
        // Resting HR from heart summary
        const hrRes = await fetch(`${FITBIT_API}/1/user/-/activities/heart/date/${d}/1d.json`, { headers: auth });
        const hr = await hrRes.json();
        // Sleep (score available on v1.2 endpoints)
        const sleepRes = await fetch(`${FITBIT_API}/1.2/user/-/sleep/date/${d}.json`, { headers: auth });
        const sleep = await sleepRes.json();
        // HRV daily is not universally available; leave null if missing
        let hrv_ms = null;
        try {
            const hrvRes = await fetch(`${FITBIT_API}/1/user/-/hrv/date/${d}/1d.json`, { headers: auth });
            if (hrvRes.ok) {
                const hrv = await hrvRes.json();
                // pick a reasonable field if present
                const v = hrv?.hrv?.[0]?.value?.dailyRmssd; // rmssd ms (if returned)
                hrv_ms = typeof v === 'number' ? v : null;
            }
        }
        catch { }
        const steps = act?.summary?.steps ?? null;
        const calories = act?.summary?.caloriesOut ??
            act?.summary?.calories ??
            null;
        const resting_hr_bpm = hr?.['activities-heart']?.[0]?.value?.restingHeartRate ?? null;
        const sleep_score = sleep?.summary?.['stages']?.score ??
            sleep?.sleep?.[0]?.score ??
            null;
        const snapshot = {
            provider: 'Fitbit',
            date: d,
            hrv_ms,
            resting_hr_bpm,
            sleep_score,
            stress_0_10: null,
            steps,
            calories,
            raw: { act, hr, sleep },
        };
        return snapshot;
    }
    // Optional helper if you add disconnect route
    async revoke(userId) {
        const t = await getDecryptedTokens(userId, 'Fitbit');
        if (!t?.accessToken)
            return;
        await fetch(FITBIT_REVOKE, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' +
                    Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64'),
            },
            body: new URLSearchParams({ token: t.accessToken }).toString(),
        }).catch(() => { });
        await deleteTokens(userId, 'Fitbit');
        await upsertWearable({
            userId,
            provider: 'Fitbit',
            connected: false,
            lastSync: null
        });
    }
}
