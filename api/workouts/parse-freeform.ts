import { openai } from '../_openai';
import { supabaseFromReq } from '../_supabase';

export const config = { runtime: 'nodejs18.x' };

// Simple rate limiting (in production, use Redis/Upstash)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per user

const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
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

  // Authenticate user
  const sb = supabaseFromReq(req);
  const { data: user, error: authError } = await sb.auth.getUser();
  if (authError || !user?.user) {
    return j({ error: 'Unauthorized' }, 401);
  }

  // Check rate limit
  if (!checkRateLimit(user.user.id)) {
    return j({ error: 'Rate limit exceeded. Please wait before trying again.' }, 429);
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return j({ error: 'Invalid JSON' }, 400);
  }

  const text = (body.text || '').slice(0, 12_000);
  if (!text) {
    return j({ error: 'text required' }, 400);
  }

  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          strict: true
        }
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

    const raw = r.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);

    return j({ 
      parsed, 
      success: true 
    });
  } catch (e: any) {
    console.error('[parse-freeform] err', e);
    
    if (e?.message?.includes('Rate limit')) {
      return j({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    }
    
    return j({ error: e?.message || 'parse failed' }, 500);
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