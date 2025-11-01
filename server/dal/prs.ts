import { supabaseAdmin } from "../lib/supabaseAdmin";

export interface InsertPRParams {
  userId: string;
  category: string;
  movement: string;
  value: number;
  unit: string;
  repMax?: number | null;
  weightKg?: number | null;
  notes?: string | null;
  workoutId?: string | null;
  date?: string;
}

export interface ListPRsOptions {
  category?: string;
  movement?: string;
}

export async function insertPR(params: InsertPRParams) {
  const { data, error } = await supabaseAdmin
    .from('prs')
    .insert({
      user_id: params.userId,
      category: params.category,
      movement: params.movement,
      value: params.value,
      unit: params.unit,
      rep_max: params.repMax || null,
      weight_kg: params.weightKg || null,
      notes: params.notes || null,
      workout_id: params.workoutId || null,
      date: params.date || new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert PR: ${error.message}`);
  }

  return data;
}

export async function listPRs(userId: string, options: ListPRsOptions = {}) {
  let query = supabaseAdmin
    .from('prs')
    .select('*')
    .eq('user_id', userId);

  if (options.category) {
    query = query.eq('category', options.category);
  }

  if (options.movement) {
    query = query.eq('movement', options.movement);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to list PRs: ${error.message}`);
  }

  return data || [];
}

export async function deletePR(userId: string, id: string) {
  const { error } = await supabaseAdmin
    .from('prs')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete PR: ${error.message}`);
  }

  return true;
}

// Get PR history for a specific movement (for graphing progress over time)
export async function getPRHistory(userId: string, movement: string, category?: string) {
  let query = supabaseAdmin
    .from('prs')
    .select('*')
    .eq('user_id', userId)
    .eq('movement', movement);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get PR history: ${error.message}`);
  }

  return data || [];
}