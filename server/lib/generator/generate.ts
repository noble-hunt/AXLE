import { generateWorkout as generateV03 } from './v03';
import { generateWorkout as generateV02 } from './v02';
import * as Sentry from '@sentry/node';

export async function generateWithFallback(seed: any, opts: any) {
  try {
    return await generateV03(seed, opts);
  } catch (err) {
    if (process.env.GENERATOR_ALLOW_FALLBACK === 'true') {
      Sentry.captureException(err, { tags: { gen: 'v03' }, level: 'warning' });
      const legacySeed = { ...seed, generatorVersion: process.env.GENERATOR_FALLBACK ?? 'v0.2.5' };
      return await generateV02(legacySeed, opts);
    }
    throw err;
  }
}