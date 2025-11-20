import { getProfile } from '../dal/profiles';
import { listReports } from '../dal/reports';
import { listWorkouts } from '../dal/workouts';
export async function deriveSuggestionSeed(userId) {
    // Fetch data with safe fallbacks
    const profile = await getProfile(userId).catch(() => null);
    const healthReports = await listReports(userId, { days: 7 }).catch(() => []);
    const recent = await listWorkouts(userId, { limit: 4 }).catch(() => []);
    // Get latest health report
    const health = healthReports && healthReports.length > 0 ? healthReports[0] : null;
    // SAFE DEFAULTS for MVP - Profile doesn't have workout preferences yet
    const inputs = {
        archetype: 'mixed',
        minutes: 30,
        targetIntensity: 6,
        equipment: ['dumbbells', 'bodyweight'],
        constraints: [],
        location: 'gym'
    };
    const context = {
        dateISO: new Date().toISOString(),
        userId,
        healthModifiers: health ? {
            axleScore: health.metrics?.axle_score ?? undefined,
            vitality: health.metrics?.vitality_score ?? undefined,
            performancePotential: health.metrics?.performance_potential ?? undefined,
            circadian: health.metrics?.circadian_alignment ?? undefined,
        } : undefined,
    };
    return { inputs, context, recent };
}
