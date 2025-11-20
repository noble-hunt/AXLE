// server/config/env.ts
import * as dotenv from 'dotenv';
dotenv.config();
const mask = (v) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : null);
const asBool = (v) => v === '1' || v === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEV = NODE_ENV !== 'production';
// Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
export const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY || AZURE_OPENAI_API_KEY);
// Flags from env
let FORCE_PREMIUM = asBool(process.env.HOBH_FORCE_PREMIUM);
let DISABLE_SIMPLE = asBool(process.env.AXLE_DISABLE_SIMPLE);
let DISABLE_MOCK = asBool(process.env.AXLE_DISABLE_MOCK);
// Development safety defaults (force premium; block fallbacks)
if (DEV) {
    if (!FORCE_PREMIUM)
        FORCE_PREMIUM = true;
    if (!DISABLE_SIMPLE)
        DISABLE_SIMPLE = true;
    if (!DISABLE_MOCK)
        DISABLE_MOCK = true;
}
export { FORCE_PREMIUM, DISABLE_SIMPLE, DISABLE_MOCK };
export const PREMIUM_NOTES_MODE_LOCAL = process.env.HOBH_PREMIUM_NOTES_MODE === 'local';
export const PREMIUM_STRICT = process.env.HOBH_PREMIUM_STRICT === '1' || process.env.HOBH_PREMIUM_STRICT === 'true';
export const ENV_DEBUG = {
    NODE_ENV, DEV,
    HAS_OPENAI_KEY,
    OPENAI_KEY_SAMPLE: mask(OPENAI_API_KEY || AZURE_OPENAI_API_KEY || ''),
    AXLE_DISABLE_SIMPLE: DISABLE_SIMPLE,
    AXLE_DISABLE_MOCK: DISABLE_MOCK,
    HOBH_FORCE_PREMIUM: FORCE_PREMIUM,
    HOBH_PREMIUM_NOTES_MODE: process.env.HOBH_PREMIUM_NOTES_MODE || null,
    HOBH_PREMIUM_STRICT: PREMIUM_STRICT,
};
