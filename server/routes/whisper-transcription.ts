import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { openai } from '../lib/openai.js';
import multer from "multer";

// Use memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Simple rate limiting state (in production, use Redis)
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

const router = Router();

// JSON base64 route - prioritized to handle JSON payloads first
router.post('/whisper', requireAuth, async (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json')) {
    return next('route'); // Skip to next route (multipart)
  }

  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;

  try {
    // Check rate limit
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait before trying again.' });
    }

    const { audioBase64, mimeType } = req.body ?? {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 required' });
    }

    const buf = Buffer.from(audioBase64, 'base64');
    
    // Validate file size
    if (buf.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'Audio file too large (max 25MB)' });
    }

    const file = new File([buf], 'audio.webm', { 
      type: mimeType || 'audio/webm' 
    });

    const r = await openai.audio.transcriptions.create({
      file,
      model: 'gpt-4o-mini-audio-preview',
      language: 'en',
      response_format: 'json'
    });

    res.json({ 
      transcript: r.text ?? '', 
      success: true 
    });
  } catch (e: any) {
    console.error('[dev whisper/json] err', e);
    
    // Handle specific OpenAI errors
    if (e?.status) {
      switch (e.status) {
        case 429:
          return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please try again later.' });
        case 402:
          return res.status(402).json({ error: 'OpenAI quota exceeded. Please contact support.' });
        case 400:
          return res.status(400).json({ error: 'Invalid audio format or file. Please try a different recording.' });
        default:
          return res.status(500).json({ error: e?.message || 'transcription failed' });
      }
    }
    
    res.status(500).json({ error: e?.message || 'transcription failed' });
  }
});

// Multipart fallback route
router.post('/whisper', requireAuth, upload.single('audio'), async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;

  try {
    // Check rate limit
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait before trying again.' });
    }

    const f = req.file;
    if (!f) {
      return res.status(400).json({ error: 'audio field required' });
    }

    // Validate file size
    if (f.size > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'Audio file too large (max 25MB)' });
    }

    // Convert Buffer to Uint8Array (proper BlobPart type) for File constructor
    const uint8Array = new Uint8Array(f.buffer);
    const file = new File([uint8Array], f.originalname || 'audio.webm', { 
      type: f.mimetype || 'audio/webm' 
    });

    console.log(`🎙️ Transcribing: ${f.originalname} (${f.size} bytes) for user ${userId}`);

    const r = await openai.audio.transcriptions.create({
      file,
      model: 'gpt-4o-mini-audio-preview',
      language: 'en',
      response_format: 'json'
    });

    console.log(`✅ Transcription completed: "${r.text?.substring(0, 100)}..."`);

    res.json({ 
      transcript: r.text ?? '', 
      success: true 
    });
  } catch (e: any) {
    console.error('[dev whisper/multipart] err', e);
    
    // Handle multer errors
    if (e instanceof multer.MulterError) {
      if (e.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Audio file too large (max 25MB)' });
      }
      return res.status(400).json({ error: `File upload error: ${e.message}` });
    }
    
    // Handle OpenAI errors
    if (e?.status) {
      switch (e.status) {
        case 429:
          return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please try again later.' });
        case 402:
          return res.status(402).json({ error: 'OpenAI quota exceeded. Please contact support.' });
        case 400:
          return res.status(400).json({ error: 'Invalid audio format or file. Please try a different recording.' });
        default:
          return res.status(500).json({ error: e?.message || 'transcription failed' });
      }
    }
    
    res.status(500).json({ error: e?.message || 'transcription failed' });
  }
});

export default router;