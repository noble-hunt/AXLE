import { type GeneratorInputs, type GeneratorContext } from '../../shared/generator-types';
import { getProfile } from '../dal/profiles';
import { listReports } from '../dal/reports';
import { listWorkouts } from '../dal/workouts';

export async function deriveSuggestionSeed(userId: string) {
  // Fetch data with safe fallbacks
  const profile = await getProfile(userId).catch(() => null);
  const healthReports = await listReports(userId, { days: 7 }).catch(() => []);
  const recent = await listWorkouts(userId, { limit: 4 }).catch(() => []);

  // Get latest health report
  const health = healthReports && healthReports.length > 0 ? healthReports[0] : null;

  // SAFE DEFAULTS for MVP
  const inputs: GeneratorInputs = {
    archetype: (profile?.default_archetype as any) ?? 'mixed',
    minutes: profile?.default_minutes ?? 30,
    targetIntensity: (profile?.default_intensity ?? 6) as GeneratorInputs['targetIntensity'],
    equipment: profile?.equipment ?? ['dumbbells', 'bodyweight'],
    constraints: profile?.constraints ?? [],
    location: (profile?.location as GeneratorInputs['location']) ?? 'gym'
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