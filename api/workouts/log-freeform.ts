import { supabaseFromReq } from '../_supabase';

export const config = { runtime: 'nodejs18.x' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return j({ error: 'Method Not Allowed' }, 405);
  }

  const sb = supabaseFromReq(req);
  
  let body: any;
  try {
    body = await req.json();
  } catch {
    return j({ error: 'Invalid JSON' }, 400);
  }

  const { parsed, title } = body ?? {};
  if (!parsed) {
    return j({ error: 'parsed required' }, 400);
  }

  // Get authenticated user (RLS)
  const { data: user, error: authError } = await sb.auth.getUser();
  if (authError || !user?.user) {
    return j({ error: 'Unauthorized' }, 401);
  }

  try {
    // Transform freeform parsed data to match database schema
    const transformedSets = parsed.sets?.map((set: any, index: number) => ({
      id: `freeform-${index}`,
      exercise: set.movement,
      weight: set.weightKg ? Math.round(set.weightKg * 2.20462 * 2) / 2 : undefined, // kg to lbs
      reps: set.reps,
      duration: set.timeCapMinutes ? set.timeCapMinutes * 60 : undefined, // minutes to seconds
      restTime: set.restMinutes ? set.restMinutes * 60 : undefined, // minutes to seconds
      notes: set.notes,
      repScheme: set.repScheme,
      timeCapMinutes: set.timeCapMinutes
    })) || [];

    // Store workout in database
    const { data, error } = await sb.from('workouts').insert({
      user_id: user.user.id,
      title: title || parsed.title || 'Freeform workout',
      request: {
        category: parsed.request?.category || 'other',
        durationMinutes: parsed.request?.durationMinutes || parsed.est_duration_min || 30,
        intensity: parsed.request?.intensity || parsed.intensity || 5
      },
      sets: transformedSets,
      notes: parsed.notes || null,
      completed: true,
      feedback: {
        source: "freeform",
        confidence: parsed.confidence || 0.8
      }
    }).select('id').single();

    if (error) {
      console.error('[log-freeform] db error:', error);
      return j({ error: error.message }, 400);
    }

    return j({ 
      id: data.id, 
      success: true 
    });
  } catch (e: any) {
    console.error('[log-freeform] err', e);
    return j({ error: e?.message || 'log failed' }, 500);
  }
}

function j(x: any, s = 200) {
  return new Response(JSON.stringify(x), {
    status: s,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    }
  });
}