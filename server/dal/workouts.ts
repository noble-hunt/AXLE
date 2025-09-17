import { supabaseAdmin } from "../lib/supabaseAdmin";

export interface InsertWorkoutParams {
  userId: string;
  workout: {
    title: string;
    request: Record<string, any>;
    sets: Record<string, any>;
    notes?: string;
    completed?: boolean;
    feedback?: Record<string, any>;
  };
}

export interface ListWorkoutsOptions {
  limit?: number;
}

export interface UpdateWorkoutPatch {
  title?: string;
  notes?: string;
  sets?: Record<string, any>;
  completed?: boolean;
  feedback?: Record<string, any>;
}

export async function insertWorkout({ userId, workout }: InsertWorkoutParams) {
  const { data, error } = await supabaseAdmin
    .from('workouts')
    .insert({
      user_id: userId,
      title: workout.title,
      request: workout.request,
      sets: workout.sets,
      notes: workout.notes,
      completed: workout.completed || false,
      feedback: workout.feedback
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert workout: ${error.message}`);
  }

  return data;
}

export async function listWorkouts(userId: string, options: ListWorkoutsOptions = {}) {
  const { limit = 50 } = options;

  const { data, error } = await supabaseAdmin
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list workouts: ${error.message}`);
  }

  return data || [];
}

export async function getWorkout(userId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get workout: ${error.message}`);
  }

  return data;
}

export async function updateWorkout(userId: string, id: string, patch: UpdateWorkoutPatch) {
  const { data, error } = await supabaseAdmin
    .from('workouts')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to update workout: ${error.message}`);
  }

  return data;
}