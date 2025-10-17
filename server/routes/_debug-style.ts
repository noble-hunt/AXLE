import { Router } from 'express';
import { normalizeStyle, SUPPORTED_STYLES } from '../lib/style';

const router = Router();

router.post('/api/_debug/resolve-style', (req, res) => {
  const raw = req.body?.style ?? req.body?.goal ?? req.body?.focus;
  const resolved = normalizeStyle(raw);
  return res.json({ ok: true, raw, resolved, supported: SUPPORTED_STYLES });
});

export default router;
