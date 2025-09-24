import { supabaseAdmin } from "../lib/supabaseAdmin";

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

/**
 * Get upsert functionality for health reports
 * @param userId - User ID
 * @param date - Report date (YYYY-MM-DD)
 * @param metrics - Metrics envelope with provider, axle, and weather data
 */
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

/**
 * Get 7-day sleep summary for a user
 * @param userId - User ID
 * @returns Average sleep score over the last 7 days
 */
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

/**
 * Get resting heart rate trend over a specified number of days
 * @param userId - User ID
 * @param days - Number of days to analyze
 * @returns RHR trend (negative = improving, positive = worsening)
 */
export async function getRHRTrend(userId: string, days: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const { data, error } = await supabaseAdmin
    .from('health_reports')
    .select('metrics, date')
    .eq('user_id', userId)
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .order('date', { ascending: true }); // Oldest first for trend calculation

  if (error) {
    console.warn('Failed to get RHR trend:', error);
    return 0;
  }

  if (!data || data.length < 2) {
    return 0; // Need at least 2 data points for a trend
  }

  const rhrValues = data
    .map(report => (report.metrics as any)?.provider?.resting_hr || (report.metrics as any)?.restingHR)
    .filter((rhr): rhr is number => typeof rhr === 'number');

  if (rhrValues.length < 2) {
    return 0;
  }

  // Simple linear trend: compare first half average to second half average
  const midpoint = Math.floor(rhrValues.length / 2);
  const firstHalf = rhrValues.slice(0, midpoint);
  const secondHalf = rhrValues.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  // Return the change: positive means RHR increased (worse), negative means decreased (better)
  return secondAvg - firstAvg;
}