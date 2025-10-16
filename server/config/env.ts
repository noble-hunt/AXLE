// server/config/env.ts
// Load .env **before any other imports**
import * as dotenv from 'dotenv';
dotenv.config();

// Mask helper
const mask = (v?: string | null) =>
  v ? `${v.slice(0, 6)}…${v.slice(-4)}` : null;

// Keys: OpenAI (direct) or Azure OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
export const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY || AZURE_OPENAI_API_KEY);

// Feature flags
export const FORCE_PREMIUM = process.env.HOBH_FORCE_PREMIUM === 'true' || process.env.HOBH_FORCE_PREMIUM === '1';
export const DISABLE_SIMPLE = process.env.AXLE_DISABLE_SIMPLE === '1';
export const DISABLE_MOCK   = process.env.AXLE_DISABLE_MOCK === '1';

// Notes-only mode for premium (run premium without OpenAI)
export const PREMIUM_NOTES_MODE_LOCAL = process.env.HOBH_PREMIUM_NOTES_MODE === 'local';

// Export for debugging
export const ENV_DEBUG = {
  HAS_OPENAI_KEY,
  OPENAI_KEY_SAMPLE: mask(OPENAI_API_KEY || AZURE_OPENAI_API_KEY || ''),
  AXLE_DISABLE_SIMPLE: process.env.AXLE_DISABLE_SIMPLE,
  AXLE_DISABLE_MOCK: process.env.AXLE_DISABLE_MOCK,
  HOBH_FORCE_PREMIUM: process.env.HOBH_FORCE_PREMIUM,
  HOBH_PREMIUM_NOTES_MODE: process.env.HOBH_PREMIUM_NOTES_MODE,
};
