/**
 * Environment detection utilities for native vs web environments
 */

/**
 * Detects if the app is running in a native environment (iOS/Android via Capacitor)
 * @returns true if running in native app, false if in web browser
 */
export const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

/**
 * Detects if the app is running in a web browser
 * @returns true if running in web browser, false if in native app
 */
export const isWeb = !isNative;

/**
 * Get the current platform type
 * @returns 'native' | 'web'
 */
export const getPlatform = (): 'native' | 'web' => {
  return isNative ? 'native' : 'web';
};

/**
 * Log the current environment for debugging
 */
export const logEnvironment = () => {
  console.log(`[ENV] Platform: ${getPlatform()}`, {
    isNative,
    isWeb,
    hasCapacitor: !!(window as any).Capacitor,
    isNativePlatform: (window as any).Capacitor?.isNativePlatform?.(),
  });
};

/**
 * API configuration with proper normalization
 */

// Env normalization: origin ONLY (http(s)://host[:port]), never include /api
const fromEnv = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim() ?? "";

// Strip any trailing slash or accidental /api suffix to guarantee "origin only"
function normalizeOrigin(v: string) {
  if (!v) return "";
  let out = v.replace(/\/+$/, "");
  // If someone set .../api or .../api/, strip it so we can add it centrally
  out = out.replace(/\/api$/i, "");
  return out;
}

export const API_ORIGIN = normalizeOrigin(fromEnv); // "" => same-origin in dev
export const API_PREFIX = "/api"; // centralized, single source of truth
export const isDev = import.meta.env.DEV;

// Runtime checks to catch regressions
if (isDev && API_ORIGIN) {
  console.log(`[ENV] API_ORIGIN: "${API_ORIGIN}"`);
  console.log(`[ENV] API_PREFIX: "${API_PREFIX}"`);
  
  // Validate origin format
  if (API_ORIGIN && !API_ORIGIN.match(/^https?:\/\/[^/]+$/)) {
    console.warn(`[ENV] WARNING: API_ORIGIN should be origin only (http(s)://host[:port]), got: "${API_ORIGIN}"`);
  }
}