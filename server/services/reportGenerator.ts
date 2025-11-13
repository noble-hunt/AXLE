import { db } from "../db";
import { workouts, prs, type ReportMetrics, type ReportInsights } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { startOfDay, endOfDay, differenceInDays, format } from "date-fns";

/**
 * Generate a complete fitness report for a user within a timeframe
 */
export async function generateReport(
  userId: string,
  frequency: 'weekly' | 'monthly',
  timeframeStart: Date,
  timeframeEnd: Date
): Promise<{ metrics: ReportMetrics; insights: ReportInsights }> {
  // Calculate all metrics in parallel
  const [workoutStats, prStats, trends] = await Promise.all([
    calculateWorkoutStats(userId, timeframeStart, timeframeEnd, frequency),
    calculatePRStats(userId, timeframeStart, timeframeEnd),
    calculateTrends(userId, timeframeStart, timeframeEnd, frequency)
  ]);

  const metrics: ReportMetrics = {
    workoutStats,
    prStats,
    trends
  };

  // Generate insights based on metrics
  const insights = generateInsights(metrics, frequency);

  return { metrics, insights };
}

/**
 * Calculate workout statistics
 */
async function calculateWorkoutStats(
  userId: string,
  timeframeStart: Date,
  timeframeEnd: Date,
  frequency: 'weekly' | 'monthly'
): Promise<ReportMetrics['workoutStats']> {
  const userWorkouts = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.createdAt, timeframeStart),
        lte(workouts.createdAt, timeframeEnd)
      )
    );

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

  return {
    totalWorkouts,
    totalMinutes,
    avgIntensity,
    completionRate,
    consistencyScore,
    categoriesBreakdown: Object.keys(categoriesMap).length > 0 ? categoriesMap : undefined
  };
}

/**
 * Calculate PR statistics
 */
async function calculatePRStats(
  userId: string,
  timeframeStart: Date,
  timeframeEnd: Date
): Promise<ReportMetrics['prStats']> {
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
    .orderBy(desc(prs.value));

  const totalPRs = userPRs.length;

  // Get top 3 PRs
  const topPRs = userPRs.slice(0, 3).map(pr => ({
    movement: pr.movement,
    improvement: `${pr.value} ${pr.unit}${pr.repMax ? ` (${pr.repMax}RM)` : ''}`,
    value: `${pr.value} ${pr.unit}`
  }));

  // Get categories improved
  const categoriesImproved = Array.from(new Set(userPRs.map(pr => pr.category)));

  return {
    totalPRs,
    topPRs,
    categoriesImproved
  };
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
