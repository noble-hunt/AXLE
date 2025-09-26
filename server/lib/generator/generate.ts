import { generateWorkout as generateV03 } from './v03';
import { generateWorkout as generateV02 } from './v02';
import * as Sentry from '@sentry/node';

// Feature flags for controlled rollout
const GENERATOR_VERSION_DEFAULT = process.env.GENERATOR_VERSION_DEFAULT || 'v0.3.0';
const GENERATOR_FALLBACK = process.env.GENERATOR_FALLBACK || 'v0.2.5';
const GENERATOR_ALLOW_FALLBACK = process.env.GENERATOR_ALLOW_FALLBACK !== 'false';

export async function generateWithFallback(seed: any, opts: any) {
  try {
    // Use configured default version (defaults to v0.3.0)
    if (GENERATOR_VERSION_DEFAULT === 'v0.2.5') {
      return await generateV02(seed, opts);
    }
    return await generateV03(seed, opts);
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
      
      // Create fallback seed with correct version
      const legacySeed = { ...seed, generatorVersion: GENERATOR_FALLBACK };
      
      if (GENERATOR_FALLBACK === 'v0.2.5') {
        return await generateV02(legacySeed, opts);
      } else {
        return await generateV03(legacySeed, opts);
      }
    }
    throw err;
  }
}