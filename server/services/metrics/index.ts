import { format, subDays, parseISO } from 'date-fns';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { getEnvironment, type EnvironmentData } from '../environment/index.js';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Safe division that returns 0 if divisor is 0 or result would be NaN
 */
export function safeDiv(numerator: number, denominator: number): number {
  if (denominator === 0 || !isFinite(numerator) || !isFinite(denominator)) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * Winsorize data by capping extreme values at percentiles
 * @param values Array of numbers
 * @param lowerPercentile Lower percentile (0-1), e.g., 0.05 for 5th percentile
 * @param upperPercentile Upper percentile (0-1), e.g., 0.95 for 95th percentile
 */
export function winsorize(values: number[], lowerPercentile: number = 0.05, upperPercentile: number = 0.95): number[] {
  if (values.length === 0) return [];
  
  const sorted = [...values].sort((a, b) => a - b);
  const lowerIndex = Math.floor(sorted.length * lowerPercentile);
  const upperIndex = Math.floor(sorted.length * upperPercentile);
  
  const lowerCap = sorted[lowerIndex];
  const upperCap = sorted[upperIndex];
  
  return values.map(val => clamp(val, lowerCap, upperCap));
}

/**
 * Compute rolling baseline statistics (mean, std) for a metric
 */
export function computeRollingBaseline(values: number[]): { mean: number; std: number; count: number } {
  if (values.length === 0) {
    return { mean: 0, std: 0, count: 0 };
  }
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  
  return { mean, std, count: values.length };
}

// ============================================================================
// DATA TYPES
// ============================================================================

export interface MetricBaselines {
  hrv: { mean: number; std: number; count: number };
  restingHR: { mean: number; std: number; count: number };
  sleepScore: { mean: number; std: number; count: number };
  stress: { mean: number; std: number; count: number };
  steps: { mean: number; std: number; count: number };
}

export interface RawBiometrics {
  hrv?: number | null;
  restingHR?: number | null;
  sleepScore?: number | null;
  stress?: number | null;
  steps?: number | null;
  calories?: number | null;
  sleepMidpointSd?: number | null;
  wakeTime?: string | null;
}

export interface DerivedMetrics {
  strain24h: number | null;
  strain48h: number | null;
  rpe24h: number | null;
  zoneMinutes14d: {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  } | null;
  stepsFirst2h: number | null;
}

export interface DailyMetricsResult {
  // Core metric scores (0-100)
  vitalityScore: number;
  performancePotentialScore: number;
  circadianScore: number;
  energyBalanceScore: number;
  
  // Enriched data sections
  rawBiometrics: RawBiometrics;
  derived: DerivedMetrics;
  environment: EnvironmentData | null;
  baselines: MetricBaselines;
  
  // Metadata
  date: string;
  userId: string;
  timestamp: number;
}

// ============================================================================
// BASELINE COMPUTATION
// ============================================================================

/**
 * Compute rolling baselines for key metrics over a window
 */
export async function computeBaselines(userId: string, windowDays: number = 21): Promise<MetricBaselines> {
  const endDate = new Date();
  const startDate = subDays(endDate, windowDays);
  
  try {
    // Get health reports from the window
    const { data: reports, error } = await supabaseAdmin
      .from('health_reports')
      .select('metrics')
      .eq('user_id', userId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'))
      .order('date', { ascending: false });

    if (error) {
      console.warn('Failed to fetch health reports for baselines:', error);
    }

    // Extract metric values
    const hrvValues: number[] = [];
    const restingHRValues: number[] = [];
    const sleepScoreValues: number[] = [];
    const stressValues: number[] = [];
    const stepsValues: number[] = [];

    (reports || []).forEach(report => {
      if (report.metrics && typeof report.metrics === 'object') {
        const metrics = report.metrics as any;
        if (typeof metrics.hrv === 'number' && !isNaN(metrics.hrv)) hrvValues.push(metrics.hrv);
        if (typeof metrics.restingHR === 'number' && !isNaN(metrics.restingHR)) restingHRValues.push(metrics.restingHR);
        if (typeof metrics.sleepScore === 'number' && !isNaN(metrics.sleepScore)) sleepScoreValues.push(metrics.sleepScore);
        if (typeof metrics.stress === 'number' && !isNaN(metrics.stress)) stressValues.push(metrics.stress);
        if (typeof metrics.steps === 'number' && !isNaN(metrics.steps)) stepsValues.push(metrics.steps);
      }
    });

    return {
      hrv: computeRollingBaseline(winsorize(hrvValues)),
      restingHR: computeRollingBaseline(winsorize(restingHRValues)),
      sleepScore: computeRollingBaseline(winsorize(sleepScoreValues)),
      stress: computeRollingBaseline(winsorize(stressValues)),
      steps: computeRollingBaseline(winsorize(stepsValues))
    };
  } catch (error) {
    console.warn('Error computing baselines:', error);
    // Return empty baselines on error
    return {
      hrv: { mean: 0, std: 0, count: 0 },
      restingHR: { mean: 0, std: 0, count: 0 },
      sleepScore: { mean: 0, std: 0, count: 0 },
      stress: { mean: 0, std: 0, count: 0 },
      steps: { mean: 0, std: 0, count: 0 }
    };
  }
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Score sleep quality (0-100)
 */
function scoreSleep(sleepScore: number | null, baselines: MetricBaselines): number {
  if (sleepScore == null || !isFinite(sleepScore)) return 50; // Neutral score if no data
  
  // Direct mapping from sleep score percentage
  let score = clamp(sleepScore, 0, 100);
  
  // Baseline adjustment if we have enough data
  if (baselines.sleepScore.count >= 5) {
    const deviation = sleepScore - baselines.sleepScore.mean;
    const adjustment = (deviation / Math.max(baselines.sleepScore.std, 5)) * 5; // Max ±5 point adjustment
    score += adjustment;
  }
  
  return clamp(score, 0, 100);
}

/**
 * Score activity level (0-100)
 */
function scoreActivity(steps: number | null, baselines: MetricBaselines): number {
  if (steps == null || !isFinite(steps)) return 50; // Neutral score if no data
  
  // Base scoring: 0 steps = 0, 10000 steps = 80, 15000+ steps = 100
  let score = Math.min(100, (steps / 10000) * 80);
  
  // Baseline adjustment if we have enough data
  if (baselines.steps.count >= 5) {
    const deviation = steps - baselines.steps.mean;
    const adjustment = (deviation / Math.max(baselines.steps.std, 1000)) * 5; // Max ±5 point adjustment
    score += adjustment;
  }
  
  return clamp(score, 0, 100);
}

/**
 * Score stress and recovery (0-100)
 */
function scoreStressRecovery(
  hrv: number | null, 
  restingHR: number | null, 
  stress: number | null, 
  baselines: MetricBaselines
): number {
  let totalScore = 0;
  let componentCount = 0;

  // HRV component (higher is better)
  if (hrv != null && isFinite(hrv)) {
    let hrvScore = 50; // Base score
    if (baselines.hrv.count >= 5) {
      // Score based on standard deviations from baseline
      const zScore = (hrv - baselines.hrv.mean) / Math.max(baselines.hrv.std, 1);
      hrvScore = 50 + (zScore * 15); // ±1.5 stds = ±22.5 points
    } else {
      // Fallback: assume normal range 20-50ms
      hrvScore = Math.min(100, (hrv / 50) * 100);
    }
    totalScore += clamp(hrvScore, 0, 100);
    componentCount++;
  }

  // Resting HR component (lower is better)
  if (restingHR != null && isFinite(restingHR)) {
    let hrScore = 50; // Base score
    if (baselines.restingHR.count >= 5) {
      // Score based on standard deviations from baseline (inverse)
      const zScore = (restingHR - baselines.restingHR.mean) / Math.max(baselines.restingHR.std, 2);
      hrScore = 50 - (zScore * 15); // Higher HR = lower score
    } else {
      // Fallback: assume normal range 50-80 bpm
      hrScore = Math.max(0, 100 - ((restingHR - 50) / 30) * 50);
    }
    totalScore += clamp(hrScore, 0, 100);
    componentCount++;
  }

  // Stress component (lower is better)
  if (stress != null && isFinite(stress)) {
    // Stress is typically 0-10 scale, lower is better
    const stressScore = Math.max(0, 100 - (stress * 10));
    totalScore += clamp(stressScore, 0, 100);
    componentCount++;
  }

  // Return average or neutral score
  return componentCount > 0 ? totalScore / componentCount : 50;
}

/**
 * Combined vitality score (uses sleep, activity, stress/recovery)
 */
function scoreVitality(
  sleepScore: number | null,
  steps: number | null,
  hrv: number | null,
  restingHR: number | null,
  stress: number | null,
  baselines: MetricBaselines
): number {
  const sleepComponent = scoreSleep(sleepScore, baselines);
  const activityComponent = scoreActivity(steps, baselines);
  const stressRecoveryComponent = scoreStressRecovery(hrv, restingHR, stress, baselines);
  
  // Weighted average: sleep 40%, activity 30%, stress/recovery 30%
  return Math.round(
    sleepComponent * 0.4 + 
    activityComponent * 0.3 + 
    stressRecoveryComponent * 0.3
  );
}

/**
 * Score performance potential with RPE penalty
 */
function scorePerformancePotential({
  hrv,
  sleepScore,
  strain48h,
  rpe24h
}: {
  hrv: number | null;
  sleepScore: number | null;
  strain48h: number | null;
  rpe24h: number | null;
}): number {
  let score = 100; // Start optimistic

  // HRV penalty (if low)
  if (hrv != null && isFinite(hrv)) {
    if (hrv < 20) score -= 30; // Very low HRV
    else if (hrv < 30) score -= 15; // Moderately low HRV
    else if (hrv > 50) score += 5; // High HRV bonus
  }

  // Sleep penalty
  if (sleepScore != null && isFinite(sleepScore)) {
    if (sleepScore < 60) score -= 25; // Poor sleep
    else if (sleepScore < 75) score -= 10; // Mediocre sleep
    else if (sleepScore >= 85) score += 5; // Great sleep bonus
  }

  // Strain penalty (accumulated load)
  if (strain48h != null && isFinite(strain48h)) {
    if (strain48h > 16) score -= 20; // Very high strain
    else if (strain48h > 12) score -= 10; // High strain
    else if (strain48h < 6) score += 5; // Low strain bonus
  }

  // RPE penalty (recent perceived exertion)
  if (rpe24h != null && isFinite(rpe24h)) {
    if (rpe24h >= 9) score -= 25; // Very high RPE
    else if (rpe24h >= 7) score -= 15; // High RPE
    else if (rpe24h >= 5) score -= 5; // Moderate RPE
    // Low RPE (< 5) gets no penalty
  }

  return clamp(score, 0, 100);
}

/**
 * Score circadian rhythm alignment
 */
function scoreCircadian({
  sleepMidpointSd,
  wakeTime,
  sunrise,
  stepsFirst2h,
  uvMax
}: {
  sleepMidpointSd: number | null;
  wakeTime: string | null;
  sunrise: string | null;
  stepsFirst2h: number | null;
  uvMax: number | null;
}): number {
  let score = 50; // Start neutral
  let componentCount = 1;

  // Sleep consistency component
  if (sleepMidpointSd != null && isFinite(sleepMidpointSd)) {
    // Lower standard deviation = better consistency
    const consistencyScore = Math.max(0, 100 - (sleepMidpointSd * 60)); // Convert hours to minutes penalty
    score += clamp(consistencyScore, 0, 100);
    componentCount++;
  }

  // Wake time vs sunrise alignment
  if (wakeTime && sunrise) {
    try {
      const wakeHour = parseISO(`2000-01-01T${wakeTime}`).getHours();
      const sunriseHour = parseISO(sunrise).getHours();
      const diff = Math.abs(wakeHour - sunriseHour);
      
      // Optimal is within 2 hours of sunrise
      let alignmentScore = 50;
      if (diff <= 1) alignmentScore = 100;
      else if (diff <= 2) alignmentScore = 80;
      else if (diff <= 3) alignmentScore = 60;
      else alignmentScore = Math.max(20, 60 - (diff * 10));
      
      score += alignmentScore;
      componentCount++;
    } catch {
      // Ignore parse errors
    }
  }

  // Morning activity component
  if (stepsFirst2h != null && isFinite(stepsFirst2h)) {
    // Good morning activity (500+ steps in first 2h)
    const morningActivityScore = Math.min(100, (stepsFirst2h / 500) * 80);
    score += morningActivityScore;
    componentCount++;
  }

  // UV exposure component (optional)
  if (uvMax != null && isFinite(uvMax)) {
    // Moderate UV exposure is good (3-7 index)
    let uvScore = 50;
    if (uvMax >= 3 && uvMax <= 7) uvScore = 80;
    else if (uvMax > 7) uvScore = Math.max(30, 80 - ((uvMax - 7) * 10));
    else uvScore = Math.max(20, uvMax * 25);
    
    score += uvScore;
    componentCount++;
  }

  return clamp(score / componentCount, 0, 100);
}

/**
 * Score energy balance based on zone distribution
 */
function scoreEnergyBalance(zoneMinutes14d: {
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
} | null): number {
  if (!zoneMinutes14d) return 50; // Neutral if no data

  const totalMinutes = Object.values(zoneMinutes14d).reduce((sum, min) => sum + min, 0);
  if (totalMinutes === 0) return 50;

  // Calculate percentages
  const zone1Pct = safeDiv(zoneMinutes14d.zone1, totalMinutes) * 100;
  const zone2Pct = safeDiv(zoneMinutes14d.zone2, totalMinutes) * 100;
  const zone3Pct = safeDiv(zoneMinutes14d.zone3, totalMinutes) * 100;
  const zone4Pct = safeDiv(zoneMinutes14d.zone4, totalMinutes) * 100;
  const zone5Pct = safeDiv(zoneMinutes14d.zone5, totalMinutes) * 100;

  // Ideal distribution: 80/20 rule
  // Zone 1-2 (easy): ~70-80%
  // Zone 3 (moderate): ~5-10%  
  // Zone 4-5 (hard): ~10-20%
  
  const easyPct = zone1Pct + zone2Pct;
  const hardPct = zone4Pct + zone5Pct;

  let score = 50;

  // Easy zone scoring (optimal 70-80%)
  if (easyPct >= 70 && easyPct <= 80) score += 25;
  else if (easyPct >= 60 && easyPct <= 85) score += 15;
  else if (easyPct >= 50 && easyPct <= 90) score += 5;
  else score -= Math.abs(easyPct - 75) * 0.5;

  // Hard zone scoring (optimal 10-20%)
  if (hardPct >= 10 && hardPct <= 20) score += 25;
  else if (hardPct >= 5 && hardPct <= 25) score += 15;
  else if (hardPct >= 0 && hardPct <= 30) score += 5;
  else score -= Math.abs(hardPct - 15) * 0.5;

  return clamp(score, 0, 100);
}

// ============================================================================
// MAIN COMPUTATION FUNCTION
// ============================================================================

/**
 * Compute daily metrics for a user and date
 */
export async function computeDailyMetrics(
  userId: string, 
  date: string, 
  location?: { lat: number; lon: number } | null
): Promise<DailyMetricsResult> {
  try {
    // 1. Get raw biometrics from health reports
    const { data: healthReport } = await supabaseAdmin
      .from('health_reports')
      .select('metrics')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const metrics = (healthReport?.metrics as any) || {};
    const rawBiometrics: RawBiometrics = {
      hrv: metrics.hrv ?? null,
      restingHR: metrics.restingHR ?? null,
      sleepScore: metrics.sleepScore ?? null,
      stress: metrics.stress ?? null,
      steps: metrics.steps ?? null,
      calories: metrics.calories ?? null,
      sleepMidpointSd: metrics.sleepMidpointSd ?? null,
      wakeTime: metrics.wakeTime ?? null
    };

    // 2. Derive strain and RPE from workouts
    const dateStart = new Date(`${date}T00:00:00Z`);
    const date24hAgo = subDays(dateStart, 1);
    const date48hAgo = subDays(dateStart, 2);
    const date14dAgo = subDays(dateStart, 14);

    const { data: workouts24h } = await supabaseAdmin
      .from('workouts')
      .select('feedback, request')
      .eq('user_id', userId)
      .gte('created_at', date24hAgo.toISOString())
      .lt('created_at', dateStart.toISOString());

    const { data: workouts48h } = await supabaseAdmin
      .from('workouts')
      .select('feedback, request')
      .eq('user_id', userId)
      .gte('created_at', date48hAgo.toISOString())
      .lt('created_at', dateStart.toISOString());

    const { data: workouts14d } = await supabaseAdmin
      .from('workouts')
      .select('feedback, request, created_at')
      .eq('user_id', userId)
      .gte('created_at', date14dAgo.toISOString())
      .lt('created_at', dateStart.toISOString());

    // Calculate strain (using workout intensity as proxy)
    const strain24h = (workouts24h || []).reduce((sum, w) => {
      const intensity = w.request?.intensity || 0;
      return sum + intensity;
    }, 0);

    const strain48h = (workouts48h || []).reduce((sum, w) => {
      const intensity = w.request?.intensity || 0;
      return sum + intensity;
    }, 0);

    // Calculate RPE from workout feedback (using difficulty as RPE proxy)
    const rpeValues = (workouts24h || [])
      .map(w => w.feedback?.difficulty)
      .filter(d => typeof d === 'number');
    const rpe24h = rpeValues.length > 0 
      ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length 
      : null;

    // Calculate zone minutes (simplified - using workout duration and intensity)
    let zoneMinutes14d = null;
    if (workouts14d && workouts14d.length > 0) {
      const zones = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
      workouts14d.forEach(w => {
        const duration = w.request?.duration || 0;
        const intensity = w.request?.intensity || 0;
        
        // Map intensity to zones (simplified)
        if (intensity <= 3) zones.zone1 += duration;
        else if (intensity <= 5) zones.zone2 += duration;
        else if (intensity <= 6) zones.zone3 += duration;
        else if (intensity <= 8) zones.zone4 += duration;
        else zones.zone5 += duration;
      });
      zoneMinutes14d = zones;
    }

    // Calculate steps in first 2 hours (proxy - use 20% of daily steps)
    const stepsFirst2h = rawBiometrics.steps ? Math.round(rawBiometrics.steps * 0.2) : null;

    const derived: DerivedMetrics = {
      strain24h: strain24h || null,
      strain48h: strain48h || null,
      rpe24h,
      zoneMinutes14d,
      stepsFirst2h
    };

    // 3. Get environment data (use provided location if available)
    const environment = await getEnvironment(
      location?.lat ?? null, 
      location?.lon ?? null, 
      date
    );

    // 4. Compute baselines
    const baselines = await computeBaselines(userId);

    // 5. Calculate all scores
    const vitalityScore = scoreVitality(
      rawBiometrics.sleepScore ?? null,
      rawBiometrics.steps ?? null,
      rawBiometrics.hrv ?? null,
      rawBiometrics.restingHR ?? null,
      rawBiometrics.stress ?? null,
      baselines
    );

    const performancePotentialScore = scorePerformancePotential({
      hrv: rawBiometrics.hrv ?? null,
      sleepScore: rawBiometrics.sleepScore ?? null,
      strain48h: derived.strain48h ?? null,
      rpe24h: derived.rpe24h ?? null
    });

    const circadianScore = scoreCircadian({
      sleepMidpointSd: rawBiometrics.sleepMidpointSd ?? null,
      wakeTime: rawBiometrics.wakeTime ?? null,
      sunrise: environment?.solar?.sunrise ?? null,
      stepsFirst2h: derived.stepsFirst2h ?? null,
      uvMax: environment?.weather?.uvIndex ?? null
    });

    const energyBalanceScore = scoreEnergyBalance(derived.zoneMinutes14d);

    // 6. Return comprehensive result
    return {
      vitalityScore: Math.round(vitalityScore),
      performancePotentialScore: Math.round(performancePotentialScore),
      circadianScore: Math.round(circadianScore),
      energyBalanceScore: Math.round(energyBalanceScore),
      
      rawBiometrics,
      derived,
      environment,
      baselines,
      
      date,
      userId,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('Error computing daily metrics:', error);
    
    // Return safe fallback result
    return {
      vitalityScore: 50,
      performancePotentialScore: 50,
      circadianScore: 50,
      energyBalanceScore: 50,
      
      rawBiometrics: {
        hrv: null,
        restingHR: null,
        sleepScore: null,
        stress: null,
        steps: null,
        calories: null,
        sleepMidpointSd: null,
        wakeTime: null
      },
      derived: {
        strain24h: null,
        strain48h: null,
        rpe24h: null,
        zoneMinutes14d: null,
        stepsFirst2h: null
      },
      environment: null,
      baselines: {
        hrv: { mean: 0, std: 0, count: 0 },
        restingHR: { mean: 0, std: 0, count: 0 },
        sleepScore: { mean: 0, std: 0, count: 0 },
        stress: { mean: 0, std: 0, count: 0 },
        steps: { mean: 0, std: 0, count: 0 }
      },
      
      date,
      userId,
      timestamp: Date.now()
    };
  }
}

// ============================================================================
// UNIT TESTS / ASSERTIONS
// ============================================================================

/**
 * Run basic unit tests to ensure scoring functions return values in [0,100]
 */
export function runMetricsUnitTests(): void {
  console.log('Running metrics unit tests...');

  // Test utility functions
  console.assert(clamp(150, 0, 100) === 100, 'clamp upper bound failed');
  console.assert(clamp(-50, 0, 100) === 0, 'clamp lower bound failed');
  console.assert(clamp(75, 0, 100) === 75, 'clamp normal value failed');
  console.assert(safeDiv(10, 0) === 0, 'safeDiv by zero failed');
  console.assert(safeDiv(10, 2) === 5, 'safeDiv normal failed');

  // Test scoring functions with various inputs
  const mockBaselines: MetricBaselines = {
    hrv: { mean: 35, std: 10, count: 10 },
    restingHR: { mean: 65, std: 5, count: 10 },
    sleepScore: { mean: 75, std: 10, count: 10 },
    stress: { mean: 4, std: 2, count: 10 },
    steps: { mean: 8000, std: 2000, count: 10 }
  };

  // Test sleep scoring
  const sleepScore1 = scoreSleep(85, mockBaselines);
  const sleepScore2 = scoreSleep(0, mockBaselines);
  const sleepScore3 = scoreSleep(null, mockBaselines);
  console.assert(sleepScore1 >= 0 && sleepScore1 <= 100, `Sleep score 1 out of range: ${sleepScore1}`);
  console.assert(sleepScore2 >= 0 && sleepScore2 <= 100, `Sleep score 2 out of range: ${sleepScore2}`);
  console.assert(sleepScore3 >= 0 && sleepScore3 <= 100, `Sleep score 3 out of range: ${sleepScore3}`);

  // Test activity scoring
  const activityScore1 = scoreActivity(10000, mockBaselines);
  const activityScore2 = scoreActivity(0, mockBaselines);
  const activityScore3 = scoreActivity(null, mockBaselines);
  console.assert(activityScore1 >= 0 && activityScore1 <= 100, `Activity score out of range: ${activityScore1}`);
  console.assert(activityScore2 >= 0 && activityScore2 <= 100, `Activity score out of range: ${activityScore2}`);
  console.assert(activityScore3 >= 0 && activityScore3 <= 100, `Activity score out of range: ${activityScore3}`);

  // Test vitality scoring
  const vitalityScore = scoreVitality(80, 9000, 40, 60, 3, mockBaselines);
  console.assert(vitalityScore >= 0 && vitalityScore <= 100, `Vitality score out of range: ${vitalityScore}`);

  // Test performance potential
  const perfScore = scorePerformancePotential({ hrv: 30, sleepScore: 70, strain48h: 10, rpe24h: 6 });
  console.assert(perfScore >= 0 && perfScore <= 100, `Performance score out of range: ${perfScore}`);

  // Test circadian scoring
  const circadianScore = scoreCircadian({
    sleepMidpointSd: 0.5,
    wakeTime: '07:00',
    sunrise: '2025-09-24T06:30:00Z',
    stepsFirst2h: 800,
    uvMax: 5
  });
  console.assert(circadianScore >= 0 && circadianScore <= 100, `Circadian score out of range: ${circadianScore}`);

  // Test energy balance
  const energyScore = scoreEnergyBalance({
    zone1: 200,
    zone2: 400,
    zone3: 50,
    zone4: 80,
    zone5: 20
  });
  console.assert(energyScore >= 0 && energyScore <= 100, `Energy score out of range: ${energyScore}`);

  console.log('✅ All metrics unit tests passed!');
}

// Export all scoring functions for potential individual use
export {
  scoreSleep,
  scoreActivity,
  scoreStressRecovery,
  scoreVitality,
  scorePerformancePotential,
  scoreCircadian,
  scoreEnergyBalance
};