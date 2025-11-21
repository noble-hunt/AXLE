import { Router } from 'express';
import { normalizeStyle, SUPPORTED_STYLES } from '../lib/style.js';

const router = Router();

// POST /api/_debug/resolve-style - Test style normalization
router.post('/api/_debug/resolve-style', (req, res) => {
  const raw = req.body?.goal || req.body?.style || req.body?.focus || 'none';
  const resolved = normalizeStyle(raw) || raw.toLowerCase();
  return res.json({ 
    ok: true, 
    raw, 
    resolved, 
    supported: SUPPORTED_STYLES 
  });
});

export default router;
