// api/suggestions.ts - Unified suggestions handler (today + generate)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, userClient, bearer, validateEnvForUser } from '../lib/api-helpers/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  
  try {
    validateEnvForUser();
    
    const adminClient = admin();
    const token = bearer(req);
    const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = userData.user.id;
    const supa = userClient(token);
    const today = new Date().toISOString().split('T')[0];

    // Route: GET /api/suggestions/today
    if (req.url?.includes('/today') && req.method === 'GET') {
      const { data: existing } = await supa
        .from('suggested_workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .limit(1)
        .single();

      if (existing) {
        return res.status(200).json({
          id: existing.id,
          userId: existing.user_id,
          date: existing.date,
          request: existing.request,
          rationale: existing.rationale,
          workoutId: existing.workout_id,
          createdAt: existing.created_at,
          isExisting: true
        });
      }

      // Generate new suggestion
      const { data: recentWorkouts } = await supa
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      const lastWorkout = recentWorkouts?.[0];
      let category = 'Cardio';
      const rationale: string[] = [];
      
      if (lastWorkout?.request?.category) {
        category = lastWorkout.request.category === 'Cardio' ? 'Strength' : 'Cardio';
        rationale.push(`Alternating from ${lastWorkout.request.category}`);
      }

      const { data: inserted } = await supa
        .from('suggested_workouts')
        .insert({
          user_id: userId,
          date: today,
          request: { category, intensity: 6, duration: 35 },
          rationale: { rulesApplied: rationale, scores: { recency: 1, weeklyBalance: 0.5, monthlyBalance: 0.5, fatigue: 0.3, novelty: 0.7 } },
          workout_id: null
        })
        .select()
        .single();

      return res.status(200).json({
        id: inserted.id,
        userId: inserted.user_id,
        date: inserted.date,
        request: inserted.request,
        rationale: inserted.rationale,
        workoutId: inserted.workout_id,
        createdAt: inserted.created_at,
        isExisting: false
      });
    }

    // Route: POST /api/suggestions/generate
    if (req.url?.includes('/generate') && req.method === 'POST') {
      const { regenerate = false } = (req.body ?? {}) as { regenerate?: boolean };

      if (regenerate) {
        const { data: recentWorkouts } = await supa
          .from('workouts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        const lastWorkout = recentWorkouts?.[0];
        let category = 'Cardio';
        const rationale: string[] = [];
        
        if (lastWorkout?.request?.category) {
          category = lastWorkout.request.category === 'Cardio' ? 'Strength' : 'Cardio';
          rationale.push(`Alternating from ${lastWorkout.request.category}`);
        }

        const { data: updated } = await supa
          .from('suggested_workouts')
          .upsert({
            user_id: userId,
            date: today,
            request: { category, intensity: 6, duration: 35 },
            rationale: { rulesApplied: rationale, scores: {} },
            workout_id: null
          })
          .select()
          .single();

        return res.status(200).json({ suggestion: updated });
      }

      // Generate workout from suggestion
      const { data: suggestion } = await supa
        .from('suggested_workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (!suggestion) {
        return res.status(404).json({ message: 'No suggestion found for today' });
      }

      const { data: workout } = await supa
        .from('workouts')
        .insert({
          user_id: userId,
          title: `${suggestion.request.category} Workout`,
          request: suggestion.request,
          sets: [],
          completed: false
        })
        .select()
        .single();

      await supa
        .from('suggested_workouts')
        .update({ workout_id: workout.id })
        .eq('id', suggestion.id);

      return res.status(200).json({ suggestion, workout });
    }

    return res.status(404).json({ message: 'Not Found' });
  } catch (error: any) {
    console.error('Suggestions error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
