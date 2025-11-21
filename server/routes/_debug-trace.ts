import { Router } from 'express';
import { normalizeStyle } from '../lib/style.js';
const router = Router();

router.post('/api/_debug/trace', (req, res) => {
  const resolved = normalizeStyle(req.body?.style ?? req.body?.goal ?? req.body?.focus);
  res.setHeader('X-AXLE-Trace', 'trace@routes.ts');
  return res.json({
    ok: true,
    raw: { style: req.body?.style, goal: req.body?.goal, focus: req.body?.focus },
    resolved,
    env: {
      HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
      AXLE_DISABLE_SIMPLE: !!process.env.AXLE_DISABLE_SIMPLE,
      AXLE_DISABLE_MOCK: !!process.env.AXLE_DISABLE_MOCK,
      HOBH_FORCE_PREMIUM: !!process.env.HOBH_FORCE_PREMIUM,
    }
  });
});

export default router;
