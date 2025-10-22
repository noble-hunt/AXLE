import { Router } from 'express';

const router = Router();

// GET /api/_debug/ai - Validate AI/OpenAI configuration
router.get('/api/_debug/ai', (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const sample = apiKey ? apiKey.slice(0, 3) + '…' + apiKey.slice(-4) : null;
  
  res.json({
    ok: true,
    NODE_ENV: process.env.NODE_ENV,
    HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_KEY_SAMPLE: sample,
    AXLE_DISABLE_SIMPLE: !!process.env.AXLE_DISABLE_SIMPLE,
    AXLE_DISABLE_MOCK: !!process.env.AXLE_DISABLE_MOCK,
    HOBH_FORCE_PREMIUM: !!process.env.HOBH_FORCE_PREMIUM
  });
});

export default router;
