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