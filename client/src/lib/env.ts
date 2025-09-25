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