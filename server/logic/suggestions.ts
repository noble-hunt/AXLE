import { db } from '../db';
import { workouts, healthReports } from '@shared/schema';
import { Category, type Workout, type HealthReport, type WorkoutRequest, type SuggestionRationale } from '@shared/schema';
import { eq, desc, gte, sql, and } from 'drizzle-orm';

// Category sets adapted to our actual enum
const LEG_HEAVY: Category[] = [Category.POWERLIFTING, Category.STRENGTH];
const UPPER_HEAVY: Category[] = [Category.STRENGTH];
const FULL_BODY: Category[] = [Category.CROSSFIT, Category.HIIT];
const SKILL: Category[] = [Category.HIIT]; // Closest to gymnastics/skills
const ENGINE: Category[] = [Category.CARDIO];

// All categories for reference
const ALL_CATEGORIES = [Category.CROSSFIT, Category.STRENGTH, Category.HIIT, Category.CARDIO, Category.POWERLIFTING];

/**
 * Fetches workout data for suggestion computation
 */
export async function fetchWorkoutData(userId: string, today: Date) {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const twentyEightDaysAgo = new Date(today);
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Fetch last 28 days of workouts (we'll filter for different periods)
  const allWorkouts = await db
    .select()
    .from(workouts)
    .where(and(
      eq(workouts.userId, userId),
      gte(workouts.createdAt, twentyEightDaysAgo)
    ))
    .orderBy(desc(workouts.createdAt));

  // Filter into different time periods
  const last1 = allWorkouts.filter(w => w.createdAt && w.createdAt >= yesterday);
  const last7 = allWorkouts.filter(w => w.createdAt && w.createdAt >= sevenDaysAgo);
  const last14 = allWorkouts.filter(w => w.createdAt && w.createdAt >= fourteenDaysAgo);
  const last28 = allWorkouts;

  return { last1, last7, last14, last28 };
}

/**
 * Fetches the latest health report
 */
export async function fetchLatestHealthReport(userId: string): Promise<HealthReport | null> {
  const reports = await db
    .select()
    .from(healthReports)
    .where(eq(healthReports.userId, userId))
    .orderBy(desc(healthReports.date))
    .limit(1);

  return reports[0] || null;
}

/**
 * Computes category counts for a given time period
 */
function computeCategoryCounts(workouts: Workout[]): Record<Category, number> {
  const counts = Object.fromEntries(ALL_CATEGORIES.map(cat => [cat, 0])) as Record<Category, number>;
  
  workouts.forEach(workout => {
    if (workout.request && typeof workout.request === 'object' && 'category' in workout.request) {
      const category = workout.request.category as Category;
      if (category in counts) {
        counts[category]++;
      }
    }
  });
  
  return counts;
}

/**
 * Gets the category from a workout request
 */
function getWorkoutCategory(workout: Workout): Category | undefined {
  if (workout.request && typeof workout.request === 'object' && 'category' in workout.request) {
    return workout.request.category as Category;
  }
  return undefined;
}

/**
 * Gets intensity from a workout request
 */
function getWorkoutIntensity(workout: Workout): number | undefined {
  if (workout.request && typeof workout.request === 'object' && 'intensity' in workout.request) {
    return workout.request.intensity as number;
  }
  return undefined;
}

/**
 * Gets duration from a workout request
 */
function getWorkoutDuration(workout: Workout): number | undefined {
  if (workout.request && typeof workout.request === 'object' && 'duration' in workout.request) {
    return workout.request.duration as number;
  }
  return undefined;
}

/**
 * Determines the complementary category based on last workout and weekly counts
 */
function complementCategory(lastCat: Category | undefined, weeklyCounts: Record<Category, number>): Category {
  // Find categories with lowest counts in 7d window
  const sortedByCount = ALL_CATEGORIES
    .map(cat => ({ category: cat, count: weeklyCounts[cat] }))
    .sort((a, b) => a.count - b.count);

  // If last was leg-heavy → prefer SKILL or ENGINE
  if (lastCat && LEG_HEAVY.includes(lastCat)) {
    const skillEngineOptions = [...SKILL, ...ENGINE];
    const availableOptions = skillEngineOptions.filter(cat => 
      weeklyCounts[cat] <= Math.min(...skillEngineOptions.map(c => weeklyCounts[c])));
    if (availableOptions.length > 0) {
      return availableOptions[0];
    }
  }

  // If last was ENGINE → prefer STRENGTH/LEG or SKILL depending on weeklyCounts
  if (lastCat && ENGINE.includes(lastCat)) {
    const strengthOptions = [...LEG_HEAVY, ...SKILL];
    const availableOptions = strengthOptions.filter(cat => 
      weeklyCounts[cat] <= Math.min(...strengthOptions.map(c => weeklyCounts[c])));
    if (availableOptions.length > 0) {
      return availableOptions[0];
    }
  }

  // Fallback to the lowest-count category overall
  return sortedByCount[0].category;
}

/**
 * Computes fatigue score based on health metrics
 */
function computeFatigue(health: HealthReport | null, last14Workouts: Workout[]): number {
  let fatigue = 0.5; // Start at 0.5

  if (health?.metrics && typeof health.metrics === 'object') {
    const metrics = health.metrics as any;

    // Compute 14d baselines for HRV and resting HR from historical data
    const hrvValues = last14Workouts.map(w => {
      if (w.feedback && typeof w.feedback === 'object' && 'hrv' in w.feedback) {
        return w.feedback.hrv as number;
      }
      return null;
    }).filter(Boolean) as number[];
    
    const restingHRValues = last14Workouts.map(w => {
      if (w.feedback && typeof w.feedback === 'object' && 'restingHR' in w.feedback) {
        return w.feedback.restingHR as number;
      }
      return null;
    }).filter(Boolean) as number[];

    // HRV check
    if (metrics.hrv && hrvValues.length > 2) {
      const meanHRV = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
      const stdHRV = Math.sqrt(hrvValues.reduce((sum, val) => sum + Math.pow(val - meanHRV, 2), 0) / hrvValues.length);
      if (metrics.hrv < meanHRV - stdHRV) {
        fatigue += 0.25;
      }
    }

    // Resting HR check
    if (metrics.restingHR && restingHRValues.length > 2) {
      const meanHR = restingHRValues.reduce((a, b) => a + b, 0) / restingHRValues.length;
      const stdHR = Math.sqrt(restingHRValues.reduce((sum, val) => sum + Math.pow(val - meanHR, 2), 0) / restingHRValues.length);
      if (metrics.restingHR > meanHR + stdHR) {
        fatigue += 0.15;
      }
    }

    // Sleep score check
    if (typeof metrics.sleepScore === 'number') {
      if (metrics.sleepScore < 60) {
        fatigue += 0.15;
      } else if (metrics.sleepScore >= 60 && metrics.sleepScore <= 74) {
        fatigue += 0.05;
      } else if (metrics.sleepScore >= 85) {
        fatigue -= 0.10;
      }
    }

    // Stress check
    if (typeof metrics.stress === 'number') {
      if (metrics.stress >= 7) {
        fatigue += 0.20;
      } else if (metrics.stress >= 4 && metrics.stress <= 6) {
        fatigue += 0.10;
      } else if (metrics.stress <= 3) {
        fatigue -= 0.05;
      }
    }
  }

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, fatigue));
}

/**
 * Computes median duration from workouts
 */
function computeMedianDuration(workouts: Workout[]): number {
  const durations = workouts
    .map(getWorkoutDuration)
    .filter(Boolean) as number[];
  
  if (durations.length === 0) return 30;
  
  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  
  if (durations.length % 2 === 0) {
    return (durations[mid - 1] + durations[mid]) / 2;
  } else {
    return durations[mid];
  }
}

/**
 * Computes average intensity from recent workouts
 */
function computeAverageIntensity(workouts: Workout[]): number {
  const intensities = workouts
    .map(getWorkoutIntensity)
    .filter(Boolean) as number[];
  
  if (intensities.length === 0) return 5;
  
  return intensities.reduce((sum, intensity) => sum + intensity, 0) / intensities.length;
}

/**
 * Checks if intensity was repeated 3 days in a row
 */
function hasRepeatedIntensity(workouts: Workout[], targetIntensity: number): boolean {
  const recentIntensities = workouts
    .slice(0, 2) // Last 2 workouts (we're planning the 3rd)
    .map(getWorkoutIntensity);
  
  return recentIntensities.length === 2 && 
         recentIntensities.every(intensity => intensity === targetIntensity);
}

/**
 * Main function to compute daily workout suggestion
 */
export async function computeSuggestion(userId: string, today = new Date()) {
  // Validate UUID format to prevent database errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error(`Invalid userId format: must be a valid UUID`);
  }
  
  const { last1, last7, last14, last28 } = await fetchWorkoutData(userId, today);
  const latestHealth = await fetchLatestHealthReport(userId);
  
  // Compute helper values
  const weeklyCounts = computeCategoryCounts(last7);
  const monthlyCounts = computeCategoryCounts(last28);
  const fatigue = computeFatigue(latestHealth, last14);
  
  // Use the most recent workout overall, not just from yesterday
  const lastWorkout = last28[0] || null;
  const lastCategory = lastWorkout ? getWorkoutCategory(lastWorkout) : undefined;
  
  // Build rationale
  const rulesApplied: string[] = [];
  
  // Determine category
  let category: Category;
  
  if (last28.length === 0) {
    // No history → alternate between Aerobic/Gymnastics by date parity
    const dayOfMonth = today.getDate();
    category = dayOfMonth % 2 === 0 ? Category.CARDIO : Category.HIIT;
    rulesApplied.push(`No workout history, alternating between Cardio and HIIT based on date parity`);
  } else {
    category = complementCategory(lastCategory, weeklyCounts);
    if (lastCategory) {
      rulesApplied.push(`Last workout was ${lastCategory}, suggesting ${category} for balance`);
    } else {
      rulesApplied.push(`Suggesting ${category} based on weekly activity balance`);
    }
  }
  
  // Determine duration
  const medianDuration = computeMedianDuration(last14);
  let duration = medianDuration;
  
  if (fatigue >= 0.7) {
    duration = Math.max(15, duration * 0.75);
    rulesApplied.push(`High fatigue detected (${fatigue.toFixed(2)}), reducing duration by 25%`);
  } else if (fatigue <= 0.3) {
    duration = Math.min(60, duration * 1.2);
    rulesApplied.push(`Low fatigue detected (${fatigue.toFixed(2)}), increasing duration by 20%`);
  }
  
  duration = Math.round(duration);
  
  // Determine intensity - start with average, no initial cap
  const avgIntensity = computeAverageIntensity(last7);
  let intensity = Math.round(avgIntensity);
  
  // Apply fatigue-based clamps
  if (fatigue >= 0.8) {
    intensity = Math.max(3, Math.min(5, intensity));
    rulesApplied.push(`Very high fatigue (${fatigue.toFixed(2)}), clamping intensity to 3-5 range`);
  } else if (fatigue >= 0.6) {
    intensity = Math.max(4, Math.min(6, intensity));
    rulesApplied.push(`High fatigue (${fatigue.toFixed(2)}), clamping intensity to 4-6 range`);
  } else if (fatigue >= 0.3) {
    intensity = Math.max(5, Math.min(7, intensity));
  } else {
    intensity = Math.max(6, Math.min(8, intensity));
    rulesApplied.push(`Low fatigue (${fatigue.toFixed(2)}), allowing higher intensity 6-8 range`);
  }
  
  // Smooth: avoid repeating exact same intensity 3 days in a row
  if (hasRepeatedIntensity(last7, intensity)) {
    const adjustment = Math.random() < 0.5 ? -1 : 1;
    const newIntensity = Math.max(1, Math.min(10, intensity + adjustment));
    rulesApplied.push(`Avoiding repeated intensity ${intensity} for 3 days, adjusting to ${newIntensity}`);
    intensity = newIntensity;
  }
  
  // Add health-specific rules (effects are already captured through fatigue scoring)
  if (latestHealth?.metrics && typeof latestHealth.metrics === 'object') {
    const metrics = latestHealth.metrics as any;
    if (metrics.stress >= 7) {
      rulesApplied.push(`High stress detected (${metrics.stress}/10), incorporated into fatigue calculation`);
    }
    if (metrics.sleepScore < 60) {
      rulesApplied.push(`Poor sleep quality (${metrics.sleepScore}%), incorporated into fatigue calculation`);
    }
  }
  
  // Build rationale object
  const rationale: SuggestionRationale = {
    rulesApplied,
    scores: {
      recency: last1.length > 0 ? 1 : 0, // 1 if worked out yesterday, 0 otherwise
      weeklyBalance: Math.max(0, 1 - (weeklyCounts[category] / Math.max(1, last7.length))),
      monthlyBalance: Math.max(0, 1 - (monthlyCounts[category] / Math.max(1, last28.length))),
      fatigue,
      novelty: weeklyCounts[category] === 0 ? 1 : Math.max(0, 1 - (weeklyCounts[category] / 7)),
    },
    sources: {
      lastWorkout,
      weeklyCounts,
      monthlyCounts,
      health: latestHealth?.metrics ? {
        hrv: (latestHealth.metrics as any).hrv || null,
        sleepScore: (latestHealth.metrics as any).sleepScore || null,
        restingHR: (latestHealth.metrics as any).restingHR || null,
        stress: (latestHealth.metrics as any).stress || null,
      } : undefined,
    },
  };
  
  const request: WorkoutRequest = {
    category,
    duration,
    intensity,
  };
  
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  return {
    date: dateStr,
    request,
    rationale,
  };
}