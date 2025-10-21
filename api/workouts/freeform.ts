// api/workouts/freeform.ts - Unified freeform handler (parse + log)
import { openai } from '../../lib/api-helpers/openai';
import { supabaseFromReq } from '../../lib/api-helpers/supabase';

export const config = { runtime: 'nodejs' };

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) return false;
  userLimit.count++;
  return true;
};

const schema = {
  name: "FreeformParsed",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      est_duration_min: { type: "number" },
      intensity: { type: "number" },
      confidence: { type: "number" },
      request: {
        type: "object",
        properties: {
          category: { type: "string" },
          durationMinutes: { type: "number" },
          intensity: { type: "number" }
        },
        required: ["category", "durationMinutes", "intensity"]
      },
      sets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            movement: { type: "string" },
            sets: { type: "number", nullable: true },
            reps: { type: "string", nullable: true },
            repScheme: { type: "string", nullable: true },
            weightKg: { type: "number", nullable: true },
            timeCapMinutes: { type: "number", nullable: true },
            restMinutes: { type: "number", nullable: true },
            notes: { type: "string", nullable: true }
          },
          required: ["movement"]
        }
      },
      notes: { type: "string", nullable: true }
    },
    required: ["title", "est_duration_min", "intensity", "confidence", "request", "sets"]
  }
} as const;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return j({ error: 'Method Not Allowed' }, 405);
  }

  const sb = supabaseFromReq(req);
  const { data: user, error: authError } = await sb.auth.getUser();
  if (authError || !user?.user) {
    return j({ error: 'Unauthorized' }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return j({ error: 'Invalid JSON' }, 400);
  }

  // Route: POST /api/workouts/parse-freeform
  if (req.url?.includes('/parse-freeform')) {
    if (!checkRateLimit(user.user.id)) {
      return j({ error: 'Rate limit exceeded. Please wait before trying again.' }, 429);
    }

    const text = (body.text || '').slice(0, 12_000);
    if (!text) return j({ error: 'text required' }, 400);

    try {
      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: {
          type: 'json_schema',
          json_schema: { name: schema.name, schema: schema.schema, strict: true }
        },
        messages: [
          {
            role: 'system',
            content: `Parse workout description into structured JSON. Extract:
- title: descriptive workout name
- est_duration_min: estimated duration 
- intensity: 1-10 scale
- confidence: 0-1 parsing confidence
- request: {category, durationMinutes, intensity} 
- sets: array of exercises with movement, sets, reps, weight, etc
- notes: additional observations

Categories: strength, cardio, crossfit, yoga, sports, other
Use reasonable estimates when data is missing.`
          },
          { role: 'user', content: text }
        ]
      });

      const raw = r.choices?.[0]?.message?.content;
      if (!raw) throw new Error('no content');

      const parsed = JSON.parse(raw);
      return j(parsed);
    } catch (e: any) {
      console.error('[parse-freeform] error:', e);
      return j({ error: e?.message || 'parse failed' }, 500);
    }
  }

  // Route: POST /api/workouts/log-freeform
  if (req.url?.includes('/log-freeform')) {
    const { parsed, title } = body ?? {};
    if (!parsed) return j({ error: 'parsed required' }, 400);

    try {
      const transformedSets = parsed.sets?.map((set: any, index: number) => ({
        id: `freeform-${index}`,
        exercise: set.movement,
        weight: set.weightKg ? Math.round(set.weightKg * 2.20462 * 2) / 2 : undefined,
        reps: set.reps,
        duration: set.timeCapMinutes ? set.timeCapMinutes * 60 : undefined,
        restTime: set.restMinutes ? set.restMinutes * 60 : undefined,
        notes: set.notes,
        repScheme: set.repScheme,
        timeCapMinutes: set.timeCapMinutes
      })) || [];

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

      return j({ id: data.id, success: true });
    } catch (e: any) {
      console.error('[log-freeform] err', e);
      return j({ error: e?.message || 'log failed' }, 500);
    }
  }

  return j({ error: 'Not Found' }, 404);
}

function j(x: any, s = 200) {
  return new Response(JSON.stringify(x), {
    status: s,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
