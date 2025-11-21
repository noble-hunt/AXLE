import { type GeneratorInputs, type GeneratorContext } from '../../shared/generator-types.js';
import { getProfile } from '../dal/profiles.js';
import { listReports } from '../dal/reports.js';
import { listWorkouts } from '../dal/workouts.js';

export async function deriveSuggestionSeed(userId: string) {
  // Fetch data with safe fallbacks
  const profile = await getProfile(userId).catch(() => null);
  const healthReports = await listReports(userId, { days: 7 }).catch(() => []);
  const recent = await listWorkouts(userId, { limit: 4 }).catch(() => []);

  // Get latest health report
  const health = healthReports && healthReports.length > 0 ? healthReports[0] : null;

  // SAFE DEFAULTS for MVP - Profile doesn't have workout preferences yet
  const inputs: GeneratorInputs = {
    archetype: 'mixed',
    minutes: 30,
    targetIntensity: 6 as GeneratorInputs['targetIntensity'],
    equipment: ['dumbbells', 'bodyweight'],
    constraints: [],
    location: 'gym' as GeneratorInputs['location']
  };

  const context: GeneratorContext = {
    dateISO: new Date().toISOString(),
    userId,
    healthModifiers: health ? {
      axleScore: (health.metrics as any)?.axle_score ?? undefined,
      vitality: (health.metrics as any)?.vitality_score ?? undefined,
      performancePotential: (health.metrics as any)?.performance_potential ?? undefined,
      circadian: (health.metrics as any)?.circadian_alignment ?? undefined,
    } : undefined,
  };

  return { inputs, context, recent };
}