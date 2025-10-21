// api/workouts/generate.ts  (Vercel serverless, Node runtime)
import { openai } from '../../lib/api-helpers/openai';
import { admin } from '../../lib/api-helpers/supabase';

export const config = { runtime: 'nodejs' };

type GenInput = {
  archetype?: string;
  minutes?: number;
  intensity?: number;
  equipment?: string[];
  seed?: string;
  // Legacy format support
  category?: string;
  durationMin?: number;
  goal?: string;
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  // Extract and verify auth token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: { message: 'Unauthorized - missing auth token' } }, 401);
  }

  const token = authHeader.substring(7);
  
  // Verify the user with Supabase
  const { data: { user }, error: authError } = await admin().auth.getUser(token);
  if (authError || !user) {
    console.error('[generate] auth error:', authError);
    return json({ ok: false, error: { message: 'Unauthorized - invalid token' } }, 401);
  }

  let payload: GenInput;
  try { 
    payload = await req.json(); 
  } catch { 
    return json({ ok: false, error: { message: 'Invalid JSON body' } }, 400); 
  }

  if (!process.env.OPENAI_API_KEY) {
    return json({ ok: false, error: { message: 'OPENAI_API_KEY missing' } }, 500);
  }

  // Support both new (archetype/minutes) and legacy (category/durationMin) formats
  const archetype = payload.archetype || payload.category || 'mixed';
  const minutes = payload.minutes || payload.durationMin || 30;
  const intensity = payload.intensity || 6;
  const equipment = payload.equipment || ['bodyweight'];
  const goal = payload.goal || 'general fitness';

  const sys = `You generate structured workouts as strict JSON. 
Return ONLY JSON with shape:
{
  "title": string,
  "est_duration_min": number,
  "intensity": number,          // 1-10
  "exercises": [
    { "name": string, "sets": number, "reps": string, "rest_sec": number, "notes": string }
  ]
}`;

  const userPrompt = `Category: ${archetype}
Duration (min): ${minutes}
Intensity (1-10): ${intensity}
Equipment: ${equipment.join(', ')}
Goal: ${goal}`;

  try {
    // Generate workout with OpenAI
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    let generatedWorkout: any;
    try { 
      generatedWorkout = JSON.parse(raw); 
    } catch { 
      return json({ ok: false, error: { message: 'LLM returned non-JSON' } }, 500);
    }

    // Save workout to Supabase
    const workoutData = {
      user_id: user.id,
      title: generatedWorkout.title || `${archetype} Workout`,
      request: payload,
      sets: generatedWorkout.exercises || [],
      notes: `${archetype} workout for ${minutes} minutes`,
      completed: false
    };

    const { data: savedWorkout, error: dbError } = await admin()
      .from('workouts')
      .insert(workoutData)
      .select()
      .single();

    if (dbError || !savedWorkout) {
      console.error('[generate] DB error:', dbError);
      return json({ ok: false, error: { message: 'Failed to save workout', details: dbError?.message } }, 500);
    }

    // Return workout with ID
    return json({ 
      ok: true, 
      workout: {
        id: savedWorkout.id,
        title: savedWorkout.title,
        exercises: generatedWorkout.exercises,
        est_duration_min: generatedWorkout.est_duration_min,
        intensity: generatedWorkout.intensity
      }
    }, 200);

  } catch (e: any) {
    console.error('[generate] error:', e);
    return json({ ok: false, error: { message: e?.message || 'generation failed' } }, 500);
  }
}

function json(x: any, status = 200) {
  return new Response(JSON.stringify(x), {
    status, 
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}