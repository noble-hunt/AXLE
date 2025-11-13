import { db } from "../db";
import { axleReports, profiles, type AxleReport, type ReportMetrics, type ReportInsights } from "@shared/schema";
import { eq, and, desc, gte, lte, isNull } from "drizzle-orm";
import { supabaseAdmin } from "../lib/supabaseAdmin";

// ============================================================================
// HEALTH REPORTS (Legacy - for health integrations like Oura, Fitbit, etc.)
// ============================================================================

export interface InsertReportParams {
  userId: string;
  date: string;
  summary?: string;
  metrics: Record<string, any>;
  suggestions: string[];
  fatigueScore?: number;
}

export interface ListReportsOptions {
  days?: number;
}

export async function insertReport(params: InsertReportParams) {
  const { data, error } = await supabaseAdmin
    .from('health_reports')
    .insert({
      user_id: params.userId,
      date: params.date,
      summary: params.summary,
      metrics: params.metrics,
      suggestions: params.suggestions,
      fatigue_score: params.fatigueScore
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert report: ${error.message}`);
  }

  return data;
}

export async function listReports(userId: string, options: ListReportsOptions = {}) {
  const { days = 30 } = options;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const { data, error } = await supabaseAdmin
    .from('health_reports')
    .select('*')
    .eq('user_id', userId)
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to list reports: ${error.message}`);
  }

  return data || [];
}

export async function upsertDailyReport(userId: string, date: string, metrics: Record<string, any>) {
  const { data, error } = await supabaseAdmin
    .from('health_reports')
    .upsert({
      user_id: userId,
      date: date,
      metrics: metrics,
      suggestions: [],
      summary: null
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert daily report: ${error.message}`);
  }

  return data;
}

export async function get7DaySleepSummary(userId: string): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  
  const { data, error } = await supabaseAdmin
    .from('health_reports')
    .select('metrics')
    .eq('user_id', userId)
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) {
    console.warn('Failed to get 7-day sleep summary:', error);
    return 0;
  }

  if (!data || data.length === 0) {
    return 0;
  }

  const sleepScores = data
    .map(report => (report.metrics as any)?.provider?.sleep_score || (report.metrics as any)?.sleepScore)
    .filter((score): score is number => typeof score === 'number');

  if (sleepScores.length === 0) {
    return 0;
  }

  return sleepScores.reduce((sum, score) => sum + score, 0) / sleepScores.length;
}

export async function getRHRTrend(userId: string, days: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const { data, error } = await supabaseAdmin
    .from('health_reports')
    .select('metrics, date')
    .eq('user_id', userId)
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    console.warn('Failed to get RHR trend:', error);
    return 0;
  }

  if (!data || data.length < 2) {
    return 0;
  }

  const rhrValues = data
    .map(report => (report.metrics as any)?.provider?.resting_hr || (report.metrics as any)?.restingHR)
    .filter((rhr): rhr is number => typeof rhr === 'number');

  if (rhrValues.length < 2) {
    return 0;
  }

  const midpoint = Math.floor(rhrValues.length / 2);
  const firstHalf = rhrValues.slice(0, midpoint);
  const secondHalf = rhrValues.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  return secondAvg - firstAvg;
}

// ============================================================================
// AXLE REPORTS (New - for weekly/monthly fitness reports)
// ============================================================================

/**
 * Fetch all reports for a user with optional filters
 */
export async function getReportsByUserId(
  userId: string,
  options?: {
    frequency?: 'weekly' | 'monthly';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<AxleReport[]> {
  let query = db
    .select()
    .from(axleReports)
    .where(eq(axleReports.userId, userId))
    .$dynamic();

  // Apply filters
  const conditions = [eq(axleReports.userId, userId)];
  
  if (options?.frequency) {
    conditions.push(eq(axleReports.frequency, options.frequency));
  }
  
  if (options?.startDate) {
    conditions.push(gte(axleReports.timeframeStart, options.startDate));
  }
  
  if (options?.endDate) {
    conditions.push(lte(axleReports.timeframeEnd, options.endDate));
  }

  query = db
    .select()
    .from(axleReports)
    .where(and(...conditions))
    .orderBy(desc(axleReports.timeframeStart))
    .$dynamic();

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return await query;
}

/**
 * Fetch a specific report by ID
 */
export async function getReportById(reportId: string, userId: string): Promise<AxleReport | null> {
  const [report] = await db
    .select()
    .from(axleReports)
    .where(
      and(
        eq(axleReports.id, reportId),
        eq(axleReports.userId, userId)
      )
    )
    .limit(1);

  return report || null;
}

/**
 * Create a new report
 */
export async function createReport(data: {
  userId: string;
  frequency: 'weekly' | 'monthly';
  timeframeStart: Date;
  timeframeEnd: Date;
  metrics: ReportMetrics;
  insights: ReportInsights;
}): Promise<AxleReport> {
  const [report] = await db
    .insert(axleReports)
    .values({
      userId: data.userId,
      frequency: data.frequency,
      timeframeStart: data.timeframeStart,
      timeframeEnd: data.timeframeEnd,
      metrics: data.metrics,
      insights: data.insights,
      status: 'ready',
      deliveryChannel: [],
    })
    .returning();

  return report;
}

/**
 * Update report status
 */
export async function updateReportStatus(
  reportId: string,
  status: 'generating' | 'ready' | 'delivered' | 'failed'
): Promise<void> {
  await db
    .update(axleReports)
    .set({ status })
    .where(eq(axleReports.id, reportId));
}

/**
 * Mark report as viewed
 */
export async function markReportAsViewed(reportId: string): Promise<void> {
  await db
    .update(axleReports)
    .set({ viewedAt: new Date() })
    .where(
      and(
        eq(axleReports.id, reportId),
        isNull(axleReports.viewedAt) // Only update if not already viewed
      )
    );
}

/**
 * Mark report as delivered
 */
export async function markReportAsDelivered(
  reportId: string,
  channel: 'email' | 'push' | 'in-app'
): Promise<void> {
  const [report] = await db
    .select()
    .from(axleReports)
    .where(eq(axleReports.id, reportId))
    .limit(1);

  if (!report) return;

  const channels = [...(report.deliveryChannel || [])];
  if (!channels.includes(channel)) {
    channels.push(channel);
  }

  await db
    .update(axleReports)
    .set({
      deliveredAt: new Date(),
      deliveryChannel: channels,
      status: 'delivered',
    })
    .where(eq(axleReports.id, reportId));
}

/**
 * Get user's report preferences
 */
export async function getReportPreferences(userId: string) {
  const [profile] = await db
    .select({
      reportFrequency: profiles.reportFrequency,
      reportWeeklyDay: profiles.reportWeeklyDay,
      reportMonthlyDay: profiles.reportMonthlyDay,
      reportDeliveryTime: profiles.reportDeliveryTime,
      enableNotifications: profiles.enableNotifications,
      enableEmail: profiles.enableEmail,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return profile || null;
}

/**
 * Update user's report preferences
 */
export async function updateReportPreferences(
  userId: string,
  preferences: {
    reportFrequency?: 'none' | 'weekly' | 'monthly' | 'both';
    reportWeeklyDay?: number | null;
    reportMonthlyDay?: number | null;
    reportDeliveryTime?: string;
    enableNotifications?: boolean;
    enableEmail?: boolean;
  }
): Promise<void> {
  await db
    .update(profiles)
    .set(preferences)
    .where(eq(profiles.userId, userId));
}

/**
 * Check if a report already exists for a user in a given timeframe
 */
export async function reportExists(
  userId: string,
  frequency: 'weekly' | 'monthly',
  timeframeStart: Date
): Promise<boolean> {
  const [existing] = await db
    .select({ id: axleReports.id })
    .from(axleReports)
    .where(
      and(
        eq(axleReports.userId, userId),
        eq(axleReports.frequency, frequency),
        eq(axleReports.timeframeStart, timeframeStart)
      )
    )
    .limit(1);

  return !!existing;
}
