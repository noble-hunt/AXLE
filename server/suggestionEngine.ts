import { Category, HealthReport, Workout } from '../shared/schema.js';
import { parseISO, isToday, subDays, differenceInDays } from 'date-fns';

export interface SuggestionTarget {
  category: Category;
  intensity: number;
  duration: number;
  rationale: string[];
}

export interface SuggestionContext {
  lastWorkouts: Array<{
    id: string;
    title: string;
    category: string;
    intensity: number;
    duration: number;
    createdAt: Date;
    request: any;
  }>;
  healthReport?: HealthReport;
  recentPRs: Array<{
    exercise: string;
    weight?: number;
    reps?: number;
    date: string;
    unit?: string;
  }>;
}

// Category groupings for intelligent variation
const CATEGORY_GROUPS = {
  LOWER_BODY_STRENGTH: [Category.POWERLIFTING, Category.STRENGTH],
  UPPER_BODY_STRENGTH: [Category.STRENGTH], 
  HIGH_INTENSITY: [Category.CROSSFIT, Category.HIIT],
  LOW_IMPACT: [Category.CARDIO],
  SKILL_BASED: [Category.CROSSFIT]
};

const PRIMARY_MUSCLE_GROUPS = {
  [Category.POWERLIFTING]: 'full_body',
  [Category.STRENGTH]: 'varies', // depends on specific workout
  [Category.CROSSFIT]: 'full_body',
  [Category.HIIT]: 'cardio_system',
  [Category.CARDIO]: 'cardio_system'
};

/**
 * Analyzes workout history and health data to suggest optimal workout for today
 */
export function computeDailySuggestion(context: SuggestionContext): SuggestionTarget {
  const rationale: string[] = [];
  let baseIntensity = 6; // Default moderate intensity
  let targetCategory = Category.CARDIO; // Default fallback
  let targetDuration = 35; // Default duration

  // STEP 1: Analyze yesterday's workout (50% weight)
  const yesterdayWorkout = getYesterdayWorkout(context.lastWorkouts);
  
  if (yesterdayWorkout) {
    rationale.push(`Yesterday: ${yesterdayWorkout.title} (${yesterdayWorkout.category}, ${yesterdayWorkout.intensity}/10)`);
    
    // Apply strong anti-repetition rules
    if (isLowerBodyFocused(yesterdayWorkout)) {
      targetCategory = Category.CARDIO;
      rationale.push("→ Avoiding lower body today after yesterday's strength focus");
    } else if (yesterdayWorkout.category === Category.HIIT || yesterdayWorkout.intensity >= 8) {
      targetCategory = Category.CARDIO;
      baseIntensity = Math.max(4, baseIntensity - 2);
      rationale.push("→ Recovery cardio after high-intensity session");
    } else if (yesterdayWorkout.category === Category.CARDIO) {
      targetCategory = Category.STRENGTH;
      rationale.push("→ Strength training to complement yesterday's cardio");
    }
  } else {
    rationale.push("No workout yesterday");
    targetCategory = Category.STRENGTH; // Fresh start with strength
  }

  // STEP 2: Analyze weekly patterns (30% weight)
  const weeklyAnalysis = analyzeWeeklyPatterns(context.lastWorkouts);
  
  // Prevent 3+ same category streaks
  if (weeklyAnalysis.consecutiveCount >= 2) {
    const alternatives = getAllCategories().filter(cat => cat !== weeklyAnalysis.streakCategory);
    targetCategory = alternatives[Math.floor(Math.random() * alternatives.length)];
    rationale.push(`→ Breaking ${weeklyAnalysis.consecutiveCount}-day ${weeklyAnalysis.streakCategory} streak`);
  }

  // Prefer least recent categories
  const leastRecentCategory = findLeastRecentCategory(context.lastWorkouts);
  if (leastRecentCategory && weeklyAnalysis.consecutiveCount < 2) {
    if (shouldPreferCategory(leastRecentCategory, yesterdayWorkout)) {
      targetCategory = leastRecentCategory;
      rationale.push(`→ Haven't done ${leastRecentCategory} recently`);
    }
  }

  // STEP 3: Health metrics adjustment (±20% variable weight)
  if (context.healthReport) {
    const healthAdjustment = analyzeHealthMetrics(context.healthReport);
    baseIntensity = Math.max(1, Math.min(10, baseIntensity + healthAdjustment.intensityModifier));
    
    if (healthAdjustment.forceCategory) {
      targetCategory = healthAdjustment.forceCategory;
      rationale.push(healthAdjustment.reason);
    }
    
    rationale.push(`Health: Recovery ${healthAdjustment.recovery}/100, Sleep ${healthAdjustment.sleep}h → Intensity ${baseIntensity}/10`);
  }

  // STEP 4: Duration adjustment based on recent patterns
  targetDuration = adjustDurationBasedOnHistory(context.lastWorkouts, baseIntensity);

  return {
    category: targetCategory,
    intensity: baseIntensity,
    duration: targetDuration,
    rationale
  };
}

function getYesterdayWorkout(workouts: SuggestionContext['lastWorkouts']) {
  const yesterday = subDays(new Date(), 1);
  return workouts.find(workout => 
    differenceInDays(new Date(), workout.createdAt) === 1
  );
}

function isLowerBodyFocused(workout: any): boolean {
  const lowerBodyCategories = [Category.POWERLIFTING];
  if (lowerBodyCategories.includes(workout.category as Category)) return true;
  
  // Check workout title/description for lower body indicators
  const title = workout.title.toLowerCase();
  return title.includes('squat') || title.includes('deadlift') || title.includes('leg');
}

function analyzeWeeklyPatterns(workouts: SuggestionContext['lastWorkouts']) {
  const recent7Days = workouts
    .filter(w => differenceInDays(new Date(), w.createdAt) <= 7)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (recent7Days.length === 0) {
    return { consecutiveCount: 0, streakCategory: null };
  }

  // Find consecutive same-category streak from most recent
  let consecutiveCount = 1;
  const streakCategory = recent7Days[0].category;
  
  for (let i = 1; i < recent7Days.length; i++) {
    if (recent7Days[i].category === streakCategory) {
      consecutiveCount++;
    } else {
      break;
    }
  }

  return { consecutiveCount, streakCategory };
}

function findLeastRecentCategory(workouts: SuggestionContext['lastWorkouts']): Category | null {
  const categories = getAllCategories();
  const recent14Days = workouts
    .filter(w => differenceInDays(new Date(), w.createdAt) <= 14);

  // Find category not done in last 14 days
  const unusedCategories = categories.filter(cat => 
    !recent14Days.some(w => w.category === cat)
  );

  if (unusedCategories.length > 0) {
    return unusedCategories[0];
  }

  // Otherwise find oldest category
  const categoryLastSeen = new Map<Category, Date>();
  recent14Days.forEach(w => {
    const cat = w.category as Category;
    if (!categoryLastSeen.has(cat) || w.createdAt > categoryLastSeen.get(cat)!) {
      categoryLastSeen.set(cat, w.createdAt);
    }
  });

  let oldestCategory: Category | null = null;
  let oldestDate: Date | null = null;

  categoryLastSeen.forEach((date, category) => {
    if (!oldestDate || date < oldestDate) {
      oldestDate = date;
      oldestCategory = category;
    }
  });

  return oldestCategory;
}

function shouldPreferCategory(category: Category, yesterdayWorkout: any): boolean {
  if (!yesterdayWorkout) return true;
  
  // Don't do same category as yesterday
  if (category === yesterdayWorkout.category) return false;
  
  // Don't do lower body if yesterday was lower body
  if (isLowerBodyFocused(yesterdayWorkout) && category === Category.POWERLIFTING) return false;
  
  return true;
}

function analyzeHealthMetrics(report: HealthReport) {
  const metrics = report.metrics as any;
  const recovery = metrics?.recovery?.score || 75; // Default decent recovery
  const sleep = metrics?.sleep?.duration || 7; // Default 7h sleep  
  const stress = 5; // Default moderate stress (would come from wearable)
  
  let intensityModifier = 0;
  let forceCategory: Category | null = null;
  let reason = '';

  // Low recovery or poor sleep
  if (recovery < 40 || sleep < 5) {
    intensityModifier = -3;
    forceCategory = Category.CARDIO;
    reason = "→ Low intensity cardio due to poor recovery/sleep";
  } else if (recovery < 70 || sleep < 6.5) {
    intensityModifier = -1;
    reason = "→ Moderate intensity due to suboptimal recovery";
  } else if (recovery > 85 && sleep > 7.5) {
    intensityModifier = +1;
    reason = "→ High recovery allows increased intensity";
  }

  // Stress override
  if (stress > 7) {
    intensityModifier = Math.min(intensityModifier, -2);
    forceCategory = Category.CARDIO;
    reason = "→ Low impact cardio due to high stress";
  }

  return {
    intensityModifier,
    forceCategory,
    reason,
    recovery,
    sleep: sleep
  };
}

function adjustDurationBasedOnHistory(workouts: SuggestionContext['lastWorkouts'], intensity: number): number {
  const recent3Days = workouts
    .filter(w => differenceInDays(new Date(), w.createdAt) <= 3)
    .slice(0, 3);

  if (recent3Days.length === 0) return 35; // Default

  const avgDuration = recent3Days.reduce((sum, w) => sum + (w.duration || 35), 0) / recent3Days.length;
  
  // Vary duration based on intensity
  let baseDuration = Math.round(avgDuration);
  
  if (intensity >= 8) {
    baseDuration = Math.min(baseDuration, 30); // High intensity = shorter
  } else if (intensity <= 4) {
    baseDuration = Math.max(baseDuration, 40); // Low intensity = longer
  }

  return Math.max(15, Math.min(90, baseDuration));
}

function getAllCategories(): Category[] {
  return [Category.CROSSFIT, Category.STRENGTH, Category.HIIT, Category.CARDIO, Category.POWERLIFTING];
}