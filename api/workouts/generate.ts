// api/workouts/generate.ts  (Vercel serverless, Node runtime)
import { openai } from '../_openai';

export const config = { runtime: 'nodejs18.x' };

type GenInput = {
  category: string;
  durationMin: number;
  intensity: number;   // 1-10
  equipment?: string[];
  goal?: string;
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { 'content-type': 'application/json' }
    });
  }

  let payload: GenInput;
  try { payload = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (!process.env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY missing' }, 500);

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

  const user = `Category: ${payload.category}
Duration (min): ${payload.durationMin}
Intensity (1-10): ${payload.intensity}
Equipment: ${payload.equipment?.join(', ') || 'bodyweight'}
Goal: ${payload.goal || 'general fitness'}`;

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // small/fast; change if desired
      temperature: 0.4,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    // Always valid JSON because of response_format, but guard anyway:
    let data: any;
    try { data = JSON.parse(raw); } catch { data = { error: 'LLM returned non-JSON' }; }

    return json({ workout: data }, 200);
  } catch (e: any) {
    console.error('[generate] error', e);
    return json({ error: e?.message || 'generation failed' }, 500);
  }

  function json(x: any, status = 200) {
    return new Response(JSON.stringify(x), {
      status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
}