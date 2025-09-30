import { openai } from '../_openai';
import { supabaseFromReq } from '../_supabase';

export const config = { runtime: 'nodejs' };

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

  try {
    const ct = req.headers.get('content-type') || '';
    let file: File | null = null;

    if (ct.includes('application/json')) {
      const { audioBase64, mimeType } = await req.json();
      if (!audioBase64) {
        return j({ error: 'audioBase64 required' }, 400);
      }
      const buf = Buffer.from(audioBase64, 'base64');
      file = new File([buf], `audio.${ext(mimeType)}`, { 
        type: mimeType || 'audio/webm' 
      });
    } else if (ct.startsWith('multipart/form-data')) {
      const form = await req.formData();
      const f = form.get('audio'); // Match the field name from frontend
      if (!(f instanceof File)) {
        return j({ error: 'audio field required' }, 400);
      }
      file = f;
    } else {
      return j({ error: 'Unsupported Content-Type' }, 415);
    }

    // Validate file size (25MB OpenAI Whisper limit)
    if (file.size > 25 * 1024 * 1024) {
      return j({ error: 'Audio file too large (max 25MB)' }, 400);
    }

    const r = await openai.audio.transcriptions.create({
      file: file!,
      model: 'whisper-1',
      language: 'en',
      response_format: 'json'
    });

    return j({ 
      transcript: r.text ?? '', 
      success: true 
    });
  } catch (e: any) {
    console.error('[whisper] err', e);
    
    // Handle specific OpenAI errors
    if (e?.status) {
      switch (e.status) {
        case 429:
          return j({ error: 'OpenAI rate limit exceeded. Please try again later.' }, 429);
        case 402:
          return j({ error: 'OpenAI quota exceeded. Please contact support.' }, 402);
        case 400:
          return j({ error: 'Invalid audio format or file. Please try a different recording.' }, 400);
        default:
          return j({ error: e?.message || 'transcription failed' }, 500);
      }
    }
    
    return j({ error: e?.message || 'transcription failed' }, 500);
  }
}

function j(x: any, status = 200) {
  return new Response(JSON.stringify(x), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    }
  });
}

function ext(mt?: string) {
  if (!mt) return 'webm';
  if (mt.includes('mp4')) return 'mp4';
  if (mt.includes('mpeg')) return 'mp3';
  if (mt.includes('wav')) return 'wav';
  if (mt.includes('ogg')) return 'ogg';
  return 'webm';
}