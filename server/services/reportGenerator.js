import { db } from "../db.js";
import { workouts, prs } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { startOfDay, endOfDay, differenceInDays, format, startOfWeek } from "date-fns";
/**
 * Generate a complete fitness report for a user within a timeframe
 */
export async function generateReport(userId, frequency, timeframeStart, timeframeEnd) {
    // Fetch raw data first (reuse for both stats and visualizations)
    const [workoutsData, prData, trends] = await Promise.all([
        fetchAndCalculateWorkoutStats(userId, timeframeStart, timeframeEnd, frequency),
        fetchAndCalculatePRStats(userId, timeframeStart, timeframeEnd),
        calculateTrends(userId, timeframeStart, timeframeEnd, frequency)
    ]);
    // Calculate visualizations using fetched data (no duplicate queries)
    const visualizations = calculateVisualizations(workoutsData.workouts, prData.prs, timeframeStart, timeframeEnd, frequency);
    const metrics = {
        workoutStats: workoutsData.stats,
        prStats: prData.stats,
        trends,
        visualizations
    };
    // Generate insights based on metrics
    const insights = generateInsights(metrics, frequency);
    return { metrics, insights };
}
/**
 * Fetch workouts and calculate statistics (returns both for reuse in visualizations)
 */
async function fetchAndCalculateWorkoutStats(userId, timeframeStart, timeframeEnd, frequency) {
    const userWorkouts = await db
        .select()
        .from(workouts)
        .where(and(eq(workouts.userId, userId), gte(workouts.createdAt, timeframeStart), lte(workouts.createdAt, timeframeEnd)))
        .orderBy(workouts.createdAt);
    const totalWorkouts = userWorkouts.length;
    // Calculate total minutes from startedAt timestamps
    let totalMinutes = 0;
    let intensitySum = 0;
    let intensityCount = 0;
    const categoriesMap = {};
    for (const workout of userWorkouts) {
        // Calculate duration if both startedAt and createdAt exist
        if (workout.startedAt && workout.createdAt) {
            const durationMs = workout.createdAt.getTime() - workout.startedAt.getTime();
            totalMinutes += Math.round(durationMs / 60000); // Convert to minutes
        }
        // Extract category from request if available
        if (workout.request && typeof workout.request === 'object') {
            const req = workout.request;
            if (req.category) {
                categoriesMap[req.category] = (categoriesMap[req.category] || 0) + 1;
            }
        }
        // Extract intensity from feedback if available
        if (workout.feedback && typeof workout.feedback === 'object') {
            const fb = workout.feedback;
            if (typeof fb.perceivedIntensity === 'number') {
                intensitySum += fb.perceivedIntensity;
                intensityCount++;
            }
        }
    }
    const avgIntensity = intensityCount > 0 ? Math.round(intensitySum / intensityCount) : null;
    // Calculate completion rate (workouts marked as completed vs total)
    const completedCount = userWorkouts.filter(w => w.completed).length;
    const completionRate = totalWorkouts > 0 ? Math.round((completedCount / totalWorkouts) * 100) : 0;
    // Calculate consistency score
    const periodDays = differenceInDays(endOfDay(timeframeEnd), startOfDay(timeframeStart)) + 1;
    const targetWorkouts = frequency === 'weekly' ? 3 : 12;
    const consistencyScore = Math.min(100, Math.round((totalWorkouts / targetWorkouts) * 100));
    const stats = {
        totalWorkouts,
        totalMinutes,
        avgIntensity,
        completionRate,
        consistencyScore,
        categoriesBreakdown: Object.keys(categoriesMap).length > 0 ? categoriesMap : undefined
    };
    return { stats, workouts: userWorkouts };
}
/**
 * Fetch PRs and calculate statistics (returns both for reuse in visualizations)
 */
async function fetchAndCalculatePRStats(userId, timeframeStart, timeframeEnd) {
    // PRs table uses date (string) type, so we need to convert Date to YYYY-MM-DD
    const startDateStr = format(timeframeStart, 'yyyy-MM-dd');
    const endDateStr = format(timeframeEnd, 'yyyy-MM-dd');
    const userPRs = await db
        .select()
        .from(prs)
        .where(and(eq(prs.userId, userId), sql `${prs.date} >= ${startDateStr}`, sql `${prs.date} <= ${endDateStr}`))
        .orderBy(prs.date); // Order by date for timeline visualization
    const totalPRs = userPRs.length;
    // Get top 3 PRs by value (coerce to number for correct sorting)
    const topPRsByValue = [...userPRs].sort((a, b) => Number(b.value) - Number(a.value));
    const topPRs = topPRsByValue.slice(0, 3).map(pr => ({
        movement: pr.movement,
        improvement: `${pr.value} ${pr.unit}${pr.repMax ? ` (${pr.repMax}RM)` : ''}`,
        value: `${pr.value} ${pr.unit}`
    }));
    // Get categories improved
    const categoriesImproved = Array.from(new Set(userPRs.map(pr => pr.category)));
    const stats = {
        totalPRs,
        topPRs,
        categoriesImproved
    };
    return { stats, prs: userPRs };
}
/**
 * Calculate trends by comparing to previous period
 */
async function calculateTrends(userId, timeframeStart, timeframeEnd, frequency) {
    // Calculate previous period
    const periodLength = differenceInDays(timeframeEnd, timeframeStart);
    const previousPeriodEnd = new Date(timeframeStart);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodLength);
    // Get current and previous period workouts
    const [currentWorkouts, previousWorkouts] = await Promise.all([
        db.select().from(workouts).where(and(eq(workouts.userId, userId), gte(workouts.createdAt, timeframeStart), lte(workouts.createdAt, timeframeEnd))),
        db.select().from(workouts).where(and(eq(workouts.userId, userId), gte(workouts.createdAt, previousPeriodStart), lte(workouts.createdAt, previousPeriodEnd)))
    ]);
    // Compare workout counts
    const workoutTrend = currentWorkouts.length > previousWorkouts.length ? 'up'
        : currentWorkouts.length < previousWorkouts.length ? 'down'
            : 'stable';
    // Compare volume (simplified - just use workout count as proxy for now)
    const volumeTrend = workoutTrend; // TODO: Calculate actual volume when available
    // Compare intensity
    const currentIntensity = currentWorkouts.reduce((sum, w) => {
        const fb = w.feedback;
        return sum + (fb?.perceivedIntensity || 0);
    }, 0) / (currentWorkouts.length || 1);
    const previousIntensity = previousWorkouts.reduce((sum, w) => {
        const fb = w.feedback;
        return sum + (fb?.perceivedIntensity || 0);
    }, 0) / (previousWorkouts.length || 1);
    const intensityTrend = currentIntensity > previousIntensity ? 'up'
        : currentIntensity < previousIntensity ? 'down'
            : 'stable';
    return {
        workoutTrend,
        volumeTrend,
        intensityTrend
    };
}
/**
 * Generate insights based on metrics
 */
function generateInsights(metrics, frequency) {
    const highlights = [];
    const recommendations = [];
    const funFacts = [];
    const badges = [];
    const periodType = frequency === 'weekly' ? 'week' : 'month';
    // Generate headline
    let headline = '';
    if (metrics.workoutStats.totalWorkouts === 0) {
        headline = `Time to get back on track this ${periodType}!`;
    }
    else if (metrics.workoutStats.consistencyScore >= 75) {
        headline = `Outstanding consistency this ${periodType}!`;
    }
    else if (metrics.prStats.totalPRs > 0) {
        headline = `${metrics.prStats.totalPRs} new PR${metrics.prStats.totalPRs > 1 ? 's' : ''} this ${periodType}!`;
    }
    else {
        headline = `${metrics.workoutStats.totalWorkouts} workout${metrics.workoutStats.totalWorkouts > 1 ? 's' : ''} completed`;
    }
    // Highlights
    if (metrics.workoutStats.totalWorkouts > 0) {
        highlights.push(`Completed ${metrics.workoutStats.totalWorkouts} workout${metrics.workoutStats.totalWorkouts > 1 ? 's' : ''}`);
    }
    if (metrics.workoutStats.totalMinutes > 0) {
        highlights.push(`${metrics.workoutStats.totalMinutes} minutes of training`);
    }
    if (metrics.prStats.totalPRs > 0) {
        highlights.push(`Set ${metrics.prStats.totalPRs} new personal record${metrics.prStats.totalPRs > 1 ? 's' : ''}`);
    }
    if (metrics.workoutStats.consistencyScore >= 75) {
        highlights.push(`${metrics.workoutStats.consistencyScore}% consistency score`);
    }
    if (metrics.trends.workoutTrend === 'up') {
        highlights.push(`Workout frequency trending up`);
    }
    // Recommendations
    if (metrics.workoutStats.totalWorkouts === 0) {
        recommendations.push("Set a goal to complete 2-3 workouts this week");
        recommendations.push("Start with a quick 20-minute session");
    }
    else {
        if (metrics.workoutStats.consistencyScore < 50) {
            recommendations.push("Try to maintain a more regular workout schedule");
        }
        if (metrics.prStats.totalPRs === 0 && metrics.workoutStats.totalWorkouts >= 3) {
            recommendations.push("Focus on progressive overload to set new PRs");
        }
        if (metrics.workoutStats.avgIntensity && metrics.workoutStats.avgIntensity >= 8) {
            recommendations.push("Consider adding recovery days to prevent overtraining");
        }
        if (metrics.trends.workoutTrend === 'down') {
            recommendations.push("Get back to your previous workout frequency");
        }
    }
    // Fun facts
    if (metrics.workoutStats.totalMinutes >= 60) {
        const hours = Math.floor(metrics.workoutStats.totalMinutes / 60);
        funFacts.push(`You spent ${hours}+ hour${hours > 1 ? 's' : ''} training this ${periodType}`);
    }
    if (metrics.prStats.categoriesImproved.length > 1) {
        funFacts.push(`You improved in ${metrics.prStats.categoriesImproved.length} different categories`);
    }
    if (metrics.workoutStats.categoriesBreakdown) {
        const categories = Object.keys(metrics.workoutStats.categoriesBreakdown);
        if (categories.length > 2) {
            funFacts.push(`You trained across ${categories.length} different workout categories`);
        }
    }
    // Badges
    if (metrics.workoutStats.consistencyScore >= 100) {
        badges.push("Perfect Consistency");
    }
    else if (metrics.workoutStats.consistencyScore >= 75) {
        badges.push("Consistent Performer");
    }
    if (metrics.prStats.totalPRs >= 3) {
        badges.push("PR Machine");
    }
    else if (metrics.prStats.totalPRs >= 1) {
        badges.push("PR Setter");
    }
    if (metrics.workoutStats.totalWorkouts >= (frequency === 'weekly' ? 5 : 20)) {
        badges.push("High Volume");
    }
    if (metrics.trends.workoutTrend === 'up' && metrics.trends.intensityTrend === 'up') {
        badges.push("Momentum Builder");
    }
    // Default values if empty
    if (highlights.length === 0) {
        highlights.push("Ready to start building momentum");
    }
    if (recommendations.length === 0) {
        recommendations.push("Keep up the great work!");
    }
    if (funFacts.length === 0) {
        funFacts.push("Every workout counts toward your goals");
    }
    if (badges.length === 0) {
        badges.push("Getting Started");
    }
    return {
        headline,
        highlights,
        recommendations,
        funFacts,
        badges
    };
}
/**
 * Calculate visualization data from fetched workouts and PRs (no duplicate queries)
 */
function calculateVisualizations(workouts, prs, timeframeStart, timeframeEnd, frequency) {
    // Helper to clamp values between 0 and 1
    const clamp = (value) => Math.max(0, Math.min(1, value));
    // Calculate workout volume buckets
    const workoutVolume = [];
    if (frequency === 'weekly') {
        // Daily aggregation for weekly reports (up to 7 days)
        const dayMap = new Map();
        workouts.forEach(workout => {
            const dayKey = format(workout.createdAt, 'yyyy-MM-dd');
            const existing = dayMap.get(dayKey) || { totalMinutes: 0, totalWorkouts: 0 };
            // Calculate duration
            let minutes = 0;
            if (workout.startedAt && workout.createdAt) {
                minutes = Math.round((workout.createdAt.getTime() - workout.startedAt.getTime()) / 60000);
            }
            dayMap.set(dayKey, {
                totalMinutes: existing.totalMinutes + minutes,
                totalWorkouts: existing.totalWorkouts + 1
            });
        });
        // Convert to array with labels (cap at 7 days for weekly reports)
        Array.from(dayMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 7) // Weekly: max 7 days
            .forEach(([date, data]) => {
            workoutVolume.push({
                date,
                totalMinutes: data.totalMinutes,
                totalWorkouts: data.totalWorkouts,
                label: format(new Date(date), 'EEE M/d') // "Mon 11/10"
            });
        });
    }
    else {
        // ISO week aggregation for monthly reports (up to 6 weeks)
        const weekMap = new Map();
        workouts.forEach(workout => {
            const weekStart = startOfWeek(workout.createdAt, { weekStartsOn: 1 }); // Monday
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            const existing = weekMap.get(weekKey) || { totalMinutes: 0, totalWorkouts: 0 };
            let minutes = 0;
            if (workout.startedAt && workout.createdAt) {
                minutes = Math.round((workout.createdAt.getTime() - workout.startedAt.getTime()) / 60000);
            }
            weekMap.set(weekKey, {
                totalMinutes: existing.totalMinutes + minutes,
                totalWorkouts: existing.totalWorkouts + 1
            });
        });
        // Convert to array with labels (cap at 6 weeks for monthly reports)
        Array.from(weekMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 6) // Monthly: max 6 weeks
            .forEach(([date, data]) => {
            workoutVolume.push({
                date,
                totalMinutes: data.totalMinutes,
                totalWorkouts: data.totalWorkouts,
                label: `Week of ${format(new Date(date), 'MMM d')}` // "Week of Nov 3"
            });
        });
    }
    // Calculate PR timeline with deltas (chronologically ordered)
    const prTimeline = [];
    const movementBestMap = new Map();
    // Sort by date descending, take most recent 50, then reverse to chronological order
    const recentPRs = prs
        .sort((a, b) => b.date.localeCompare(a.date)) // Descending: newest first
        .slice(0, 50) // Take 50 most recent
        .reverse(); // Reverse to chronological order (oldest to newest)
    recentPRs.forEach(pr => {
        const prValue = Number(pr.value);
        const previousBest = movementBestMap.get(pr.movement) || null;
        const delta = previousBest !== null ? prValue - previousBest : null;
        prTimeline.push({
            date: pr.date,
            movement: pr.movement,
            value: prValue,
            unit: pr.unit,
            delta
        });
        // Update best for this movement
        if (previousBest === null || prValue > previousBest) {
            movementBestMap.set(pr.movement, prValue);
        }
    });
    // Calculate consistency heatmap (daily breakdown within timeframe)
    const consistencyHeatmap = [];
    const dailyWorkoutMap = new Map();
    workouts.forEach(workout => {
        const dayKey = format(workout.createdAt, 'yyyy-MM-dd');
        const existing = dailyWorkoutMap.get(dayKey) || { count: 0, minutes: 0 };
        let minutes = 0;
        if (workout.startedAt && workout.createdAt) {
            minutes = Math.round((workout.createdAt.getTime() - workout.startedAt.getTime()) / 60000);
        }
        dailyWorkoutMap.set(dayKey, {
            count: existing.count + 1,
            minutes: existing.minutes + minutes
        });
    });
    // Generate heatmap for all days in timeframe (strictly cap at 90 days)
    const heatmapStartDate = new Date(Math.max(timeframeStart.getTime(), timeframeEnd.getTime() - (89 * 24 * 60 * 60 * 1000) // 90 days back from end
    ));
    let currentDate = new Date(heatmapStartDate);
    const endDate = new Date(timeframeEnd);
    while (currentDate <= endDate && consistencyHeatmap.length < 90) {
        const dayKey = format(currentDate, 'yyyy-MM-dd');
        const data = dailyWorkoutMap.get(dayKey) || { count: 0, minutes: 0 };
        // Calculate intensity value: clamp((minutes/45 + count/2)/2, 0, 1)
        const value = clamp((data.minutes / 45 + data.count / 2) / 2);
        consistencyHeatmap.push({
            date: dayKey, // Already JSON-safe string
            value: Number(value.toFixed(2)), // Ensure JSON-safe number
            workoutCount: Number(data.count) // Ensure JSON-safe number
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    // NEW: Calculate training load timeline (daily volume by category)
    const trainingLoad = [];
    const trainingLoadMap = new Map();
    workouts.forEach(workout => {
        const dayKey = format(workout.createdAt, 'yyyy-MM-dd');
        const existing = trainingLoadMap.get(dayKey) || { categories: {}, totalMinutes: 0, intensities: [] };
        // Get category from request
        let category = 'Unknown';
        if (workout.request && typeof workout.request === 'object') {
            const req = workout.request;
            category = req.category || 'Unknown';
        }
        // Calculate duration
        let minutes = 0;
        if (workout.startedAt && workout.createdAt) {
            minutes = Math.round((workout.createdAt.getTime() - workout.startedAt.getTime()) / 60000);
        }
        // Aggregate by category
        existing.categories[category] = (existing.categories[category] || 0) + minutes;
        existing.totalMinutes += minutes;
        // Collect intensities
        if (workout.feedback && typeof workout.feedback === 'object') {
            const fb = workout.feedback;
            if (typeof fb.perceivedIntensity === 'number') {
                existing.intensities.push(fb.perceivedIntensity);
            }
        }
        trainingLoadMap.set(dayKey, existing);
    });
    // Convert to array (cap at 31 days)
    Array.from(trainingLoadMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-31) // Last 31 days
        .forEach(([date, data]) => {
        const avgIntensity = data.intensities.length > 0
            ? data.intensities.reduce((sum, i) => sum + i, 0) / data.intensities.length
            : null;
        trainingLoad.push({
            date,
            categories: data.categories,
            totalMinutes: data.totalMinutes,
            avgIntensity: avgIntensity ? Number(avgIntensity.toFixed(1)) : null
        });
    });
    // NEW: Calculate streak data
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let totalActiveDays = 0;
    // Sort all unique workout days
    const workoutDays = Array.from(dailyWorkoutMap.keys()).sort();
    totalActiveDays = workoutDays.length;
    // Calculate streaks by checking consecutive days
    for (let i = 0; i < workoutDays.length; i++) {
        const currentDay = new Date(workoutDays[i]);
        const previousDay = i > 0 ? new Date(workoutDays[i - 1]) : null;
        if (previousDay && differenceInDays(currentDay, previousDay) === 1) {
            tempStreak++;
        }
        else {
            tempStreak = 1;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
    }
    // Check if current streak is active (includes today or yesterday)
    if (workoutDays.length > 0) {
        const lastWorkoutDay = new Date(workoutDays[workoutDays.length - 1]);
        const today = new Date();
        const daysDiff = differenceInDays(startOfDay(today), startOfDay(lastWorkoutDay));
        if (daysDiff <= 1) {
            currentStreak = tempStreak;
        }
    }
    const periodDays = differenceInDays(endOfDay(timeframeEnd), startOfDay(timeframeStart)) + 1;
    const totalRestDays = periodDays - totalActiveDays;
    const streakData = {
        currentStreak,
        longestStreak,
        totalActiveDays,
        totalRestDays
    };
    // NEW: Calculate PR sparklines (top 5 movements)
    const prSparklines = [];
    const movementPRsMap = new Map();
    // Group PRs by movement
    prs.forEach(pr => {
        if (!movementPRsMap.has(pr.movement)) {
            movementPRsMap.set(pr.movement, []);
        }
        movementPRsMap.get(pr.movement).push(pr);
    });
    // Find top 5 movements by most recent PR count
    const topMovements = Array.from(movementPRsMap.entries())
        .map(([movement, movementPRs]) => ({
        movement,
        prs: movementPRs.sort((a, b) => a.date.localeCompare(b.date)), // Chronological
        latestPR: movementPRs[movementPRs.length - 1]
    }))
        .sort((a, b) => b.prs.length - a.prs.length)
        .slice(0, 5);
    topMovements.forEach(({ movement, prs: movementPRs, latestPR }) => {
        if (movementPRs.length < 2)
            return; // Need at least 2 PRs for progression
        const timeline = movementPRs.map(pr => ({
            date: pr.date,
            value: Number(pr.value),
            unit: pr.unit
        }));
        const firstValue = Number(movementPRs[0].value);
        const latestValue = Number(latestPR.value);
        const improvementDelta = latestValue - firstValue;
        const improvementPercent = firstValue > 0 ? (improvementDelta / firstValue) * 100 : 0;
        prSparklines.push({
            movement,
            category: latestPR.category || 'Unknown',
            timeline,
            latestValue,
            improvement: `+${improvementDelta.toFixed(0)} ${latestPR.unit}`,
            improvementDelta,
            improvementPercent: Number(improvementPercent.toFixed(1))
        });
    });
    // NEW: Recovery correlation (placeholder - requires health data integration)
    // For now, return empty array. Will populate when health integrations are active.
    const recoveryCorrelation = [];
    // Final safety check: hard cap all arrays to prevent schema violations
    // Always return all fields (even if empty) so frontend components can show empty states
    return {
        workoutVolume: workoutVolume.length > 0 ? workoutVolume.slice(0, 26) : [],
        prTimeline: prTimeline.length > 0 ? prTimeline.slice(0, 50) : [],
        consistencyHeatmap: consistencyHeatmap.length > 0 ? consistencyHeatmap.slice(0, 90) : [],
        trainingLoad: trainingLoad.length > 0 ? trainingLoad.slice(0, 31) : [],
        streakData,
        prSparklines: prSparklines.length > 0 ? prSparklines.slice(0, 5) : [],
        recoveryCorrelation: recoveryCorrelation.length > 0 ? recoveryCorrelation.slice(0, 31) : []
    };
}
