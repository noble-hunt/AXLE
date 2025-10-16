// server/config/env.ts
// Load .env **before any other imports**
import * as dotenv from 'dotenv';
dotenv.config();

// Mask helper
const mask = (v?: string | null) =>
  v ? `${v.slice(0, 6)}…${v.slice(-4)}` : null;

// Boolean helper - accepts '1' or 'true'
const asBool = (v?: string) => v === '1' || v === 'true';

// Keys: OpenAI (direct) or Azure OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
export const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY || AZURE_OPENAI_API_KEY);

// Feature flags
export const FORCE_PREMIUM = asBool(process.env.HOBH_FORCE_PREMIUM);
export const DISABLE_SIMPLE = asBool(process.env.AXLE_DISABLE_SIMPLE);
export const DISABLE_MOCK = asBool(process.env.AXLE_DISABLE_MOCK);

// Notes-only mode for premium (run premium without OpenAI)
export const PREMIUM_NOTES_MODE_LOCAL = process.env.HOBH_PREMIUM_NOTES_MODE === 'local';

// Export for debugging - shows parsed boolean values
export const ENV_DEBUG = {
  HAS_OPENAI_KEY,
  OPENAI_KEY_SAMPLE: mask(OPENAI_API_KEY || AZURE_OPENAI_API_KEY || ''),
  AXLE_DISABLE_SIMPLE: DISABLE_SIMPLE,
  AXLE_DISABLE_MOCK: DISABLE_MOCK,
  HOBH_FORCE_PREMIUM: FORCE_PREMIUM,
  HOBH_PREMIUM_NOTES_MODE: process.env.HOBH_PREMIUM_NOTES_MODE || null,
};
