import { db } from "../db";
import { workouts, prs, type ReportMetrics, type ReportInsights } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { startOfDay, endOfDay, differenceInDays, format, startOfWeek } from "date-fns";

/**
 * Generate a complete fitness report for a user within a timeframe
 */
export async function generateReport(
  userId: string,
  frequency: 'weekly' | 'monthly',
  timeframeStart: Date,
  timeframeEnd: Date
): Promise<{ metrics: ReportMetrics; insights: ReportInsights }> {
  // Fetch raw data first (reuse for both stats and visualizations)
  const [workoutsData, prData, trends] = await Promise.all([
    fetchAndCalculateWorkoutStats(userId, timeframeStart, timeframeEnd, frequency),
    fetchAndCalculatePRStats(userId, timeframeStart, timeframeEnd),
    calculateTrends(userId, timeframeStart, timeframeEnd, frequency)
  ]);

  // Calculate visualizations using fetched data (no duplicate queries)
  const visualizations = calculateVisualizations(
    workoutsData.workouts,
    prData.prs,
    timeframeStart,
    timeframeEnd,
    frequency
  );

  const metrics: ReportMetrics = {
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
async function fetchAndCalculateWorkoutStats(
  userId: string,
  timeframeStart: Date,
  timeframeEnd: Date,
  frequency: 'weekly' | 'monthly'
): Promise<{ stats: ReportMetrics['workoutStats']; workouts: any[] }> {
  const userWorkouts = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.createdAt, timeframeStart),
        lte(workouts.createdAt, timeframeEnd)
      )
    )
    .orderBy(workouts.createdAt);

  const totalWorkouts = userWorkouts.length;
  
  // Calculate total minutes from startedAt timestamps
  let totalMinutes = 0;
  let intensitySum = 0;
  let intensityCount = 0;
  const categoriesMap: Record<string, number> = {};

  for (const workout of userWorkouts) {
    // Calculate duration if both startedAt and createdAt exist
    if (workout.startedAt && workout.createdAt) {
      const durationMs = workout.createdAt.getTime() - workout.startedAt.getTime();
      totalMinutes += Math.round(durationMs / 60000); // Convert to minutes
    }

    // Extract category from request if available
    if (workout.request && typeof workout.request === 'object') {
      const req = workout.request as any;
      if (req.category) {
        categoriesMap[req.category] = (categoriesMap[req.category] || 0) + 1;
      }
    }

    // Extract intensity from feedback if available
    if (workout.feedback && typeof workout.feedback === 'object') {
      const fb = workout.feedback as any;
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
async function fetchAndCalculatePRStats(
  userId: string,
  timeframeStart: Date,
  timeframeEnd: Date
): Promise<{ stats: ReportMetrics['prStats']; prs: any[] }> {
  // PRs table uses date (string) type, so we need to convert Date to YYYY-MM-DD
  const startDateStr = format(timeframeStart, 'yyyy-MM-dd');
  const endDateStr = format(timeframeEnd, 'yyyy-MM-dd');

  const userPRs = await db
    .select()
    .from(prs)
    .where(
      and(
        eq(prs.userId, userId),
        sql`${prs.date} >= ${startDateStr}`,
        sql`${prs.date} <= ${endDateStr}`
      )
    )
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
async function calculateTrends(
  userId: string,
  timeframeStart: Date,
  timeframeEnd: Date,
  frequency: 'weekly' | 'monthly'
): Promise<ReportMetrics['trends']> {
  // Calculate previous period
  const periodLength = differenceInDays(timeframeEnd, timeframeStart);
  const previousPeriodEnd = new Date(timeframeStart);
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - periodLength);

  // Get current and previous period workouts
  const [currentWorkouts, previousWorkouts] = await Promise.all([
    db.select().from(workouts).where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.createdAt, timeframeStart),
        lte(workouts.createdAt, timeframeEnd)
      )
    ),
    db.select().from(workouts).where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.createdAt, previousPeriodStart),
        lte(workouts.createdAt, previousPeriodEnd)
      )
    )
  ]);

  // Compare workout counts
  const workoutTrend = currentWorkouts.length > previousWorkouts.length ? 'up' 
    : currentWorkouts.length < previousWorkouts.length ? 'down' 
    : 'stable';

  // Compare volume (simplified - just use workout count as proxy for now)
  const volumeTrend = workoutTrend; // TODO: Calculate actual volume when available

  // Compare intensity
  const currentIntensity = currentWorkouts.reduce((sum, w) => {
    const fb = w.feedback as any;
    return sum + (fb?.perceivedIntensity || 0);
  }, 0) / (currentWorkouts.length || 1);

  const previousIntensity = previousWorkouts.reduce((sum, w) => {
    const fb = w.feedback as any;
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
function generateInsights(
  metrics: ReportMetrics,
  frequency: 'weekly' | 'monthly'
): ReportInsights {
  const highlights: string[] = [];
  const recommendations: string[] = [];
  const funFacts: string[] = [];
  const badges: string[] = [];

  const periodType = frequency === 'weekly' ? 'week' : 'month';

  // Generate headline
  let headline = '';
  if (metrics.workoutStats.totalWorkouts === 0) {
    headline = `Time to get back on track this ${periodType}!`;
  } else if (metrics.workoutStats.consistencyScore >= 75) {
    headline = `Outstanding consistency this ${periodType}!`;
  } else if (metrics.prStats.totalPRs > 0) {
    headline = `${metrics.prStats.totalPRs} new PR${metrics.prStats.totalPRs > 1 ? 's' : ''} this ${periodType}!`;
  } else {
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
  } else {
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
  } else if (metrics.workoutStats.consistencyScore >= 75) {
    badges.push("Consistent Performer");
  }

  if (metrics.prStats.totalPRs >= 3) {
    badges.push("PR Machine");
  } else if (metrics.prStats.totalPRs >= 1) {
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
function calculateVisualizations(
  workouts: any[],
  prs: any[],
  timeframeStart: Date,
  timeframeEnd: Date,
  frequency: 'weekly' | 'monthly'
): NonNullable<ReportMetrics['visualizations']> {
  // Helper to clamp values between 0 and 1
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  
  // Calculate workout volume buckets
  const workoutVolume: any[] = [];
  
  if (frequency === 'weekly') {
    // Daily aggregation for weekly reports (up to 7 days)
    const dayMap = new Map<string, {totalMinutes: number; totalWorkouts: number}>();
    
    workouts.forEach(workout => {
      const dayKey = format(workout.createdAt, 'yyyy-MM-dd');
      const existing = dayMap.get(dayKey) || {totalMinutes: 0, totalWorkouts: 0};
      
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
  } else {
    // ISO week aggregation for monthly reports (up to 6 weeks)
    const weekMap = new Map<string, {totalMinutes: number; totalWorkouts: number}>();
    
    workouts.forEach(workout => {
      const weekStart = startOfWeek(workout.createdAt, { weekStartsOn: 1 }); // Monday
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      const existing = weekMap.get(weekKey) || {totalMinutes: 0, totalWorkouts: 0};
      
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
  
  // Calculate PR timeline with deltas
  const prTimeline: any[] = [];
  const movementBestMap = new Map<string, number>();
  
  prs
    .sort((a, b) => a.date.localeCompare(b.date)) // Sort by date ascending
    .slice(0, 50) // Cap at 50 most recent PRs
    .forEach(pr => {
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
  const consistencyHeatmap: any[] = [];
  const dailyWorkoutMap = new Map<string, {count: number; minutes: number}>();
  
  workouts.forEach(workout => {
    const dayKey = format(workout.createdAt, 'yyyy-MM-dd');
    const existing = dailyWorkoutMap.get(dayKey) || {count: 0, minutes: 0};
    
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
  const heatmapStartDate = new Date(Math.max(
    timeframeStart.getTime(),
    timeframeEnd.getTime() - (89 * 24 * 60 * 60 * 1000) // 90 days back from end
  ));
  
  let currentDate = new Date(heatmapStartDate);
  const endDate = new Date(timeframeEnd);
  
  while (currentDate <= endDate && consistencyHeatmap.length < 90) {
    const dayKey = format(currentDate, 'yyyy-MM-dd');
    const data = dailyWorkoutMap.get(dayKey) || {count: 0, minutes: 0};
    
    // Calculate intensity value: clamp((minutes/45 + count/2)/2, 0, 1)
    const value = clamp((data.minutes / 45 + data.count / 2) / 2);
    
    consistencyHeatmap.push({
      date: dayKey, // Already JSON-safe string
      value: Number(value.toFixed(2)), // Ensure JSON-safe number
      workoutCount: Number(data.count) // Ensure JSON-safe number
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Final safety check: hard cap all arrays to prevent schema violations
  return {
    workoutVolume: workoutVolume.length > 0 ? workoutVolume.slice(0, 26) : undefined,
    prTimeline: prTimeline.length > 0 ? prTimeline.slice(0, 50) : undefined,
    consistencyHeatmap: consistencyHeatmap.length > 0 ? consistencyHeatmap.slice(0, 90) : undefined
  };
}
