/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag management for progressive rollouts
 */

export interface FeatureFlags {
  workouts: {
    v2: {
      enabled: boolean;
      useMLPolicy: boolean;
      debugMetrics: boolean;
    };
  };
}

export const featureFlags: FeatureFlags = {
  workouts: {
    v2: {
      enabled: true,
      useMLPolicy: false, // Future ML policy integration
      debugMetrics: true, // Show metrics debug info in response
    },
  },
};

/**
 * Get a feature flag value
 */
export function getFlag(path: string): boolean {
  const parts = path.split('.');
  let current: any = featureFlags;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }
  
  return Boolean(current);
}

/**
 * Check if workout v2 is enabled
 */
export function isWorkoutV2Enabled(): boolean {
  return getFlag('workouts.v2.enabled');
}

/**
 * Check if ML policy should be used for workout generation
 */
export function useMLPolicy(): boolean {
  return getFlag('workouts.v2.useMLPolicy');
}

/**
 * Check if metrics debug info should be included in workout generation response
 */
export function shouldShowMetricsDebug(): boolean {
  return getFlag('workouts.v2.debugMetrics');
}