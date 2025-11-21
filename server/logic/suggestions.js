import { db } from '../db.js';
import { workouts, healthReports } from '@shared/schema';
import { Category } from '@shared/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
// Category sets adapted to our actual enum
const LEG_HEAVY = [Category.POWERLIFTING, Category.STRENGTH];
const UPPER_HEAVY = [Category.STRENGTH];
const FULL_BODY = [Category.CROSSFIT, Category.HIIT];
const SKILL = [Category.HIIT]; // Closest to gymnastics/skills
const ENGINE = [Category.CARDIO];
// All categories for reference
const ALL_CATEGORIES = [Category.CROSSFIT, Category.STRENGTH, Category.HIIT, Category.CARDIO, Category.POWERLIFTING];
/**
 * Fetches workout data for suggestion computation
 */
export async function fetchWorkoutData(userId, today) {
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
        .where(and(eq(workouts.userId, userId), gte(workouts.createdAt, twentyEightDaysAgo)))
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
export async function fetchLatestHealthReport(userId) {
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
function computeCategoryCounts(workouts) {
    const counts = Object.fromEntries(ALL_CATEGORIES.map(cat => [cat, 0]));
    workouts.forEach(workout => {
        if (workout.request && typeof workout.request === 'object' && 'category' in workout.request) {
            const category = workout.request.category;
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
function getWorkoutCategory(workout) {
    if (workout.request && typeof workout.request === 'object' && 'category' in workout.request) {
        return workout.request.category;
    }
    return undefined;
}
/**
 * Gets intensity from a workout request
 */
function getWorkoutIntensity(workout) {
    if (workout.request && typeof workout.request === 'object' && 'intensity' in workout.request) {
        return workout.request.intensity;
    }
    return undefined;
}
/**
 * Gets duration from a workout request
 */
function getWorkoutDuration(workout) {
    if (workout.request && typeof workout.request === 'object' && 'duration' in workout.request) {
        return workout.request.duration;
    }
    return undefined;
}
/**
 * Determines the complementary category based on last workout and weekly counts
 */
function complementCategory(lastCat, weeklyCounts) {
    // Find categories with lowest counts in 7d window
    const sortedByCount = ALL_CATEGORIES
        .map(cat => ({ category: cat, count: weeklyCounts[cat] }))
        .sort((a, b) => a.count - b.count);
    // If last was leg-heavy → prefer SKILL or ENGINE
    if (lastCat && LEG_HEAVY.includes(lastCat)) {
        const skillEngineOptions = [...SKILL, ...ENGINE];
        const availableOptions = skillEngineOptions.filter(cat => weeklyCounts[cat] <= Math.min(...skillEngineOptions.map(c => weeklyCounts[c])));
        if (availableOptions.length > 0) {
            return availableOptions[0];
        }
    }
    // If last was ENGINE → prefer STRENGTH/LEG or SKILL depending on weeklyCounts
    if (lastCat && ENGINE.includes(lastCat)) {
        const strengthOptions = [...LEG_HEAVY, ...SKILL];
        const availableOptions = strengthOptions.filter(cat => weeklyCounts[cat] <= Math.min(...strengthOptions.map(c => weeklyCounts[c])));
        if (availableOptions.length > 0) {
            return availableOptions[0];
        }
    }
    // Fallback to the lowest-count category overall
    return sortedByCount[0].category;
}
/**
 * Computes fatigue score based on health metrics using specified formula:
 * fatigue = clamp01(
 *   base(0.5)
 *   + (sleepScore<60 ? +0.15 : sleepScore>=85 ? -0.10 : +0.05)
 *   + (restingHR>baseline+1σ ? +0.15 : 0)
 *   + (hrv<baseline-1σ ? +0.25 : 0)
 *   + (stress>=7 ? +0.20 : stress>=4 ? +0.10 : -0.05)
 * )
 */
export function computeFatigue(health, last14Workouts, rulesApplied) {
    let fatigue = 0.5; // Start at 0.5
    if (health?.metrics && typeof health.metrics === 'object') {
        const metrics = health.metrics;
        // Compute 14d baselines for HRV and resting HR from historical health reports
        // Note: For now using workout feedback data as baseline, could be enhanced to use historical health reports
        const hrvValues = last14Workouts.map(w => {
            if (w.feedback && typeof w.feedback === 'object' && 'hrv' in w.feedback) {
                return w.feedback.hrv;
            }
            return null;
        }).filter(Boolean);
        const restingHRValues = last14Workouts.map(w => {
            if (w.feedback && typeof w.feedback === 'object' && 'restingHR' in w.feedback) {
                return w.feedback.restingHR;
            }
            return null;
        }).filter(Boolean);
        // Sleep score check - exact formula from spec
        if (typeof metrics.sleepScore === 'number') {
            if (metrics.sleepScore < 60) {
                fatigue += 0.15;
                rulesApplied.push(`Poor sleep (${metrics.sleepScore}%) → increase fatigue by 0.15`);
            }
            else if (metrics.sleepScore >= 85) {
                fatigue -= 0.10;
                rulesApplied.push(`Excellent sleep (${metrics.sleepScore}%) → reduce fatigue by 0.10`);
            }
            else {
                fatigue += 0.05;
                rulesApplied.push(`Moderate sleep (${metrics.sleepScore}%) → slight fatigue increase`);
            }
        }
        // Resting HR check - baseline + 1σ
        if (metrics.restingHR && restingHRValues.length > 2) {
            const meanHR = restingHRValues.reduce((a, b) => a + b, 0) / restingHRValues.length;
            const stdHR = Math.sqrt(restingHRValues.reduce((sum, val) => sum + Math.pow(val - meanHR, 2), 0) / restingHRValues.length);
            if (metrics.restingHR > meanHR + stdHR) {
                fatigue += 0.15;
                rulesApplied.push(`Elevated resting HR (${metrics.restingHR} vs baseline ${Math.round(meanHR)}) → increase fatigue`);
            }
        }
        // HRV check - baseline - 1σ  
        if (metrics.hrv && hrvValues.length > 2) {
            const meanHRV = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
            const stdHRV = Math.sqrt(hrvValues.reduce((sum, val) => sum + Math.pow(val - meanHRV, 2), 0) / hrvValues.length);
            if (metrics.hrv < meanHRV - stdHRV) {
                fatigue += 0.25;
                rulesApplied.push(`Low HRV vs baseline → cap intensity at 5`);
            }
        }
        // Stress check - exact formula from spec
        if (typeof metrics.stress === 'number') {
            if (metrics.stress >= 7) {
                fatigue += 0.20;
                rulesApplied.push(`High stress (${metrics.stress}/10) → reduce intensity`);
            }
            else if (metrics.stress >= 4) {
                fatigue += 0.10;
                rulesApplied.push(`Moderate stress (${metrics.stress}/10) → slight intensity reduction`);
            }
            else {
                fatigue -= 0.05;
                rulesApplied.push(`Low stress (${metrics.stress}/10) → allow higher intensity`);
            }
        }
    }
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, fatigue));
}
/**
 * Computes median duration from workouts
 */
function computeMedianDuration(workouts) {
    const durations = workouts
        .map(getWorkoutDuration)
        .filter(Boolean);
    if (durations.length === 0)
        return 30;
    durations.sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    if (durations.length % 2 === 0) {
        return (durations[mid - 1] + durations[mid]) / 2;
    }
    else {
        return durations[mid];
    }
}
/**
 * Computes average intensity from recent workouts
 */
function computeAverageIntensity(workouts) {
    const intensities = workouts
        .map(getWorkoutIntensity)
        .filter(Boolean);
    if (intensities.length === 0)
        return 5;
    return intensities.reduce((sum, intensity) => sum + intensity, 0) / intensities.length;
}
/**
 * Checks if intensity was repeated 3 days in a row
 */
function hasRepeatedIntensity(workouts, targetIntensity) {
    const recentIntensities = workouts
        .slice(0, 2) // Last 2 workouts (we're planning the 3rd)
        .map(getWorkoutIntensity);
    return recentIntensities.length === 2 &&
        recentIntensities.every(intensity => intensity === targetIntensity);
}
/**
 * Returns the category that has been least represented in recent workouts
 */
function getUnderrepresentedCategory(weeklyCounts) {
    const categories = Object.values(Category);
    let minCategory = Category.STRENGTH;
    let minCount = weeklyCounts[minCategory] || 0;
    for (const category of categories) {
        const count = weeklyCounts[category] || 0;
        if (count < minCount) {
            minCount = count;
            minCategory = category;
        }
    }
    return minCategory;
}
/**
 * Main function to compute daily workout suggestion
 */
export async function computeSuggestion(userId, today = new Date()) {
    // Validate UUID format to prevent database errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
        throw new Error(`Invalid userId format: must be a valid UUID`);
    }
    const { last1, last7, last14, last28 } = await fetchWorkoutData(userId, today);
    const latestHealth = await fetchLatestHealthReport(userId);
    // Extract new health metrics from computed daily metrics
    const healthMetrics = latestHealth?.metrics;
    const performancePotential = healthMetrics?.performancePotentialScore ?? null;
    const vitality = healthMetrics?.vitalityScore ?? null;
    const energyBalance = healthMetrics?.energyBalanceScore ?? null;
    const circadian = healthMetrics?.circadianScore ?? null;
    const environment = healthMetrics?.environment || null;
    const uvMax = environment?.weather?.uvIndex ?? null;
    console.log(`🎯 Suggestion metrics: performance=${performancePotential}, vitality=${vitality}, energy=${energyBalance}, circadian=${circadian}, uvMax=${uvMax}`);
    // Compute helper values
    const weeklyCounts = computeCategoryCounts(last7);
    const monthlyCounts = computeCategoryCounts(last28);
    // Use the most recent workout overall, not just from yesterday
    const lastWorkout = last28[0] || null;
    const lastCategory = lastWorkout ? getWorkoutCategory(lastWorkout) : undefined;
    // Build rationale
    const rulesApplied = [];
    // Compute fatigue with rules tracking (keeping original logic as fallback)
    const fatigue = computeFatigue(latestHealth, last14, rulesApplied);
    // Determine category
    let category;
    let customSuggestions = [];
    // NEW LOGIC: Performance & Energy-based suggestions
    if (performancePotential !== null && performancePotential < 55) {
        // Low performance → suggest zone 2 + mobility
        category = Category.CARDIO; // Zone 2 falls under cardio
        rulesApplied.push(`Low performance potential (${performancePotential}) → recommending Zone 2 cardio + mobility work`);
        customSuggestions.push("Focus on Zone 2 heart rate training (conversational pace)");
        customSuggestions.push("Include 10-15 minutes of mobility/stretching work");
    }
    else if (performancePotential !== null && performancePotential > 75 && energyBalance !== null && energyBalance < 50) {
        // High performance but low energy balance → suggest underrepresented zone
        const underrepresentedCategory = getUnderrepresentedCategory(weeklyCounts);
        category = underrepresentedCategory;
        rulesApplied.push(`High performance (${performancePotential}) but low energy balance (${energyBalance}) → suggesting underrepresented zone: ${category}`);
        customSuggestions.push("Your body is ready for intensity, but energy balance suggests targeting underrepresented training zones");
    }
    else if (last28.length === 0) {
        // No history → alternate between Aerobic/Gymnastics by date parity
        const dayOfMonth = today.getDate();
        category = dayOfMonth % 2 === 0 ? Category.CARDIO : Category.HIIT;
        rulesApplied.push(`No workout history, alternating between Cardio and HIIT based on date parity`);
    }
    else {
        category = complementCategory(lastCategory, weeklyCounts);
        if (lastCategory) {
            rulesApplied.push(`Last workout was ${lastCategory}, suggesting ${category} for balance`);
        }
        else {
            rulesApplied.push(`Suggesting ${category} based on weekly activity balance`);
        }
    }
    // NEW LOGIC: Daylight walk suggestion
    if (uvMax !== null && uvMax >= 3 && circadian !== null && circadian < 65) {
        customSuggestions.push("Add a 10-20 minute daylight walk within 90 minutes of waking to improve circadian rhythm");
        rulesApplied.push(`UV index ${uvMax} ≥ 3 and circadian score ${circadian} < 65 → recommending morning daylight exposure`);
    }
    // Determine duration
    const medianDuration = computeMedianDuration(last14);
    let duration = medianDuration;
    // Apply fatigue-based duration adjustments
    if (fatigue >= 0.7) {
        duration = Math.max(15, duration * 0.75);
        rulesApplied.push(`High fatigue (${fatigue.toFixed(2)}) → shorten duration 25%`);
    }
    else if (fatigue <= 0.3) {
        duration = Math.min(60, duration * 1.2);
        rulesApplied.push(`Low fatigue (${fatigue.toFixed(2)}) → extend duration 20%`);
    }
    // Additional sleep-based duration adjustment
    if (latestHealth?.metrics && typeof latestHealth.metrics === 'object') {
        const metrics = latestHealth.metrics;
        if (typeof metrics.sleepScore === 'number' && metrics.sleepScore < 60) {
            duration = Math.max(15, duration * 0.75);
            rulesApplied.push(`Poor sleep (${metrics.sleepScore}) → shorten duration 25%`);
        }
    }
    duration = Math.round(duration);
    // Determine intensity - start with average, no initial cap
    const avgIntensity = computeAverageIntensity(last7);
    let intensity = Math.round(avgIntensity);
    // Apply fatigue-based clamps
    if (fatigue >= 0.8) {
        intensity = Math.max(3, Math.min(5, intensity));
        rulesApplied.push(`Very high fatigue (${fatigue.toFixed(2)}), clamping intensity to 3-5 range`);
    }
    else if (fatigue >= 0.6) {
        intensity = Math.max(4, Math.min(6, intensity));
        rulesApplied.push(`High fatigue (${fatigue.toFixed(2)}), clamping intensity to 4-6 range`);
    }
    else if (fatigue >= 0.3) {
        intensity = Math.max(5, Math.min(7, intensity));
    }
    else {
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
    // Health metrics have already been incorporated into fatigue calculation and rules
    // Build rationale object
    const rationale = {
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
                hrv: latestHealth.metrics.hrv || null,
                sleepScore: latestHealth.metrics.sleepScore || null,
                restingHR: latestHealth.metrics.restingHR || null,
                stress: latestHealth.metrics.stress || null,
                performancePotential,
                vitality,
                energyBalance,
                circadian,
                uvMax,
            } : undefined,
        },
    };
    const request = {
        category,
        duration,
        intensity,
    };
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    return {
        date: dateStr,
        request,
        rationale,
        customSuggestions,
    };
}
