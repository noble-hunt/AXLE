import { MetricsEnvelope } from "@shared/health/types";
import { getUserRecentWorkouts } from "../dal/workouts.js"; // existing DAL
import { get7DaySleepSummary, getRHRTrend } from "../dal/reports.js"; // helper you have or add thin wrappers

type Inputs = {
  userId: string;
  dateISO: string;                 // today's date (UTC)
  metrics: MetricsEnvelope;        // already has provider + weather
};

export async function computeAxleScores({ userId, dateISO, metrics }: Inputs): Promise<MetricsEnvelope["axle"]> {
  const p = metrics.provider;
  const w = metrics.weather;

  // ---- Pull workout context (7-day lookback) ----
  const recent = await getUserRecentWorkouts(userId, { days: 7 });
  const totalActiveMins = recent.reduce((s: number, w: any) => s + (w.total_active_minutes ?? 0), 0);
  const avgIntensity = recent.length ? (recent.reduce((s: number, w: any) => s + (w.intensity ?? 5), 0) / recent.length) : 5; // 1-10 scale
  const intensityFactor = Math.min(1, Math.max(0, (avgIntensity - 3) / 7)); // normalize 0..1

  // Sleep quality proxy (0..100)
  const sleepScore = (p.sleep_score ?? 0);
  const sleepQuality = Math.max(0, Math.min(100, sleepScore));

  // Recovery proxy from HRV & RHR trend
  const hrv = p.hrv ?? 0;
  const rhr = p.resting_hr ?? 0;
  const rhrTrend = await getRHRTrend(userId, 7); // negative (down) is good; map to 0..1
  const rhrTrend01 = Math.max(0, Math.min(1, (10 - Math.min(10, Math.max(-10, rhrTrend)))) / 10);
  const hrv01 = Math.max(0, Math.min(1, hrv / 120)); // assume 120ms healthy upper bound for scale
  const recovery01 = (0.65 * hrv01) + (0.35 * rhrTrend01);

  // Activity 0..1 (steps/active minutes proxy)
  const activity01 = Math.max(0, Math.min(1, totalActiveMins / (45 * 7))); // 45 min/day target

  // Weather exposure/circadian alignment features
  const uv = w?.uv_index ?? null;
  const aqi = w?.aqi ?? null;
  const sunrise = w?.sunrise ? new Date(w.sunrise) : null;
  const sunset  = w?.sunset  ? new Date(w.sunset)  : null;

  // If we have sunrise/sunset, award adherence when workouts start within +/- 3h of daylight and sleep aligns with dark.
  let circadian01 = 0.5; // neutral
  if (sunrise && sunset) {
    // crude adherence: more daytime activity + consistent sleep increases score
    const dayActivityBias = 0.6;  // heavier weight for moving in daylight
    const pollutionPenalty = aqi != null ? Math.max(0, Math.min(0.2, (aqi - 50) / 500)) : 0; // small penalty
    const uvBonus = uv != null ? Math.max(0, Math.min(0.15, (uv / 11) * 0.15)) : 0;          // tiny boost
    circadian01 = Math.max(0, Math.min(1, (dayActivityBias * activity01 + 0.4 * recovery01 + uvBonus - pollutionPenalty)));
  }

  // Vitality (no mood, per your constraint)
  const vitality =
    0.30 * (sleepQuality / 100) +
    0.25 * activity01 +
    0.25 * recovery01 +
    0.20 * intensityFactor; // use workout intensity as the "subjective" proxy

  // Performance Potential – bias toward readiness + intensity tolerance
  const performance =
    0.50 * recovery01 +
    0.30 * intensityFactor +
    0.20 * (1 - Math.max(0, Math.min(1, (rhr - 50) / 40))); // lower RHR → higher potential

  // Energy Systems balance from last 28 days (pull buckets from workouts if you have them)
  const last28 = await getUserRecentWorkouts(userId, { days: 28 });
  const counts = { alactic: 0, lactic: 0, aerobic: 0 };
  for (const w of last28) {
    const sys = (w.energy_system as keyof typeof counts) ?? "aerobic";
    counts[sys] = (counts[sys] ?? 0) + 1;
  }
  const total = Math.max(1, counts.alactic + counts.lactic + counts.aerobic);
  const ideal = total / 3;
  const imbalance =
    Math.abs(counts.alactic - ideal) + Math.abs(counts.lactic - ideal) + Math.abs(counts.aerobic - ideal);
  const energyBalance01 = Math.max(0, 1 - (imbalance / (total))); // 0..1 where 1 = well balanced

  // Aggregate AXLE Health Score – simple mean of 4
  const axle =
    0.25 * vitality +
    0.25 * performance +
    0.25 * circadian01 +
    0.25 * energyBalance01;

  const toPct = (x: number) => Math.round(Math.max(0, Math.min(100, x * 100)));

  return {
    vitality_score: toPct(vitality),
    performance_potential: toPct(performance),
    circadian_alignment: toPct(circadian01),
    energy_systems_balance: toPct(energyBalance01),
    axle_health_score: toPct(axle),
  };
}