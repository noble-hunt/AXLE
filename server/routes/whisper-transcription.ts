import type { Express } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import OpenAI from "openai";
import multer from "multer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use memory storage to avoid directory issues
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (OpenAI Whisper limit)
  },
  fileFilter: (req, file, cb) => {
    // Accept specific audio types that work well with Whisper
    const allowedTypes = [
      'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp3', 'audio/m4a',
      'audio/mp4', 'audio/mpeg', 'video/webm' // webm can contain audio
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported audio format. Please use webm, ogg, wav, mp3, or m4a.'));
    }
  }
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

export function registerWhisperRoutes(app: Express) {
  app.post('/api/stt/whisper', requireAuth, upload.single('audio'), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    try {
      // Check rate limit
      if (!checkRateLimit(userId)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait before trying again.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      const audioFile = req.file;
      console.log(`🎙️ Transcribing audio file: ${audioFile.originalname} (${audioFile.size} bytes) for user ${userId}`);

      // Validate file size
      if (audioFile.size > 25 * 1024 * 1024) {
        return res.status(400).json({ error: 'Audio file too large (max 25MB)' });
      }

      try {
        // Create a blob from the buffer for OpenAI
        const audioBlob = new Blob([audioFile.buffer], { type: audioFile.mimetype });
        
        // Call OpenAI Whisper API with current model
        const transcription = await openai.audio.transcriptions.create({
          file: new File([audioBlob], audioFile.originalname, { type: audioFile.mimetype }),
          model: "whisper-1", // Using whisper-1 as it's the current available model
          language: "en",
          response_format: "json", // Use json format to get structured response
        });

        // Extract text from response object
        const transcriptText = typeof transcription === 'string' ? transcription : transcription.text;
        
        if (!transcriptText) {
          throw new Error('No transcription text received from OpenAI');
        }

        console.log(`✅ Transcription completed: "${transcriptText.substring(0, 100)}..."`);

        res.json({ 
          transcript: transcriptText.trim(),
          success: true 
        });

      } catch (openaiError: any) {
        console.error('OpenAI Whisper API error:', openaiError);
        
        // Handle specific OpenAI error types
        if (openaiError?.status) {
          switch (openaiError.status) {
            case 429:
              return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please try again later.' });
            case 402:
              return res.status(402).json({ error: 'OpenAI quota exceeded. Please contact support.' });
            case 400:
              return res.status(400).json({ error: 'Invalid audio format or file. Please try a different recording.' });
            default:
              return res.status(500).json({ error: `OpenAI API error: ${openaiError.message || 'Unknown error'}` });
          }
        }
        
        if (openaiError instanceof Error) {
          return res.status(500).json({ error: `Transcription failed: ${openaiError.message}` });
        }
        
        return res.status(500).json({ error: 'Transcription failed. Please try again.' });
      }

    } catch (error) {
      console.error('Whisper route error:', error);

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Audio file too large (max 25MB)' });
        }
        return res.status(400).json({ error: `File upload error: ${error.message}` });
      }

      if (error instanceof Error && error.message.includes('Only audio files')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });
}