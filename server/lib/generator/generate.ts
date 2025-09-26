import { generateWorkout as generateV03 } from './v03';
import { generateWorkout as generateV02 } from './v02';
import * as Sentry from '@sentry/node';

// Feature flags for controlled rollout
const GENERATOR_VERSION_DEFAULT = process.env.GENERATOR_VERSION_DEFAULT || 'v0.3.0';
const GENERATOR_FALLBACK = process.env.GENERATOR_FALLBACK || 'v0.2.5';
const GENERATOR_ALLOW_FALLBACK = process.env.GENERATOR_ALLOW_FALLBACK !== 'false';

export async function generateWithFallback(seed: any, opts: any) {
  let usedVersion = GENERATOR_VERSION_DEFAULT;
  
  try {
    // Use configured default version (defaults to v0.3.0)
    if (GENERATOR_VERSION_DEFAULT === 'v0.2.5') {
      const result = await generateV02(seed, opts);
      return { ...result, meta: { ...result.meta, usedVersion: 'v0.2.5' } };
    }
    
    const result = await generateV03(seed, opts);
    return { ...result, meta: { ...result.meta, usedVersion: 'v0.3.0' } };
  } catch (err) {
    if (GENERATOR_ALLOW_FALLBACK) {
      console.log(`Generator ${GENERATOR_VERSION_DEFAULT} failed, falling back to ${GENERATOR_FALLBACK}`);
      Sentry.captureException(err, { 
        tags: { 
          generator: GENERATOR_VERSION_DEFAULT,
          fallback: GENERATOR_FALLBACK 
        }, 
        level: 'warning' 
      });
      
      // Normalize seed format for v0.2 compatibility
      const legacySeed = normalizeSeedForV02(seed, GENERATOR_FALLBACK);
      usedVersion = GENERATOR_FALLBACK;
      
      if (GENERATOR_FALLBACK === 'v0.2.5') {
        const result = await generateV02(legacySeed, opts);
        return { ...result, meta: { ...result.meta, usedVersion: 'v0.2.5', fallback: true } };
      } else {
        const result = await generateV03(legacySeed, opts);
        return { ...result, meta: { ...result.meta, usedVersion: 'v0.3.0', fallback: true } };
      }
    }
    throw err;
  }
}

// Helper function to normalize seed format for v0.2 compatibility
function normalizeSeedForV02(seed: any, version: string) {
  // If seed already has inputs structure, return as is
  if (seed && typeof seed === 'object' && 'inputs' in seed) {
    return { ...seed, generatorVersion: version };
  }
  
  // Otherwise, wrap the seed in inputs format expected by v0.2
  return {
    inputs: seed,
    generatorVersion: version
  };
}