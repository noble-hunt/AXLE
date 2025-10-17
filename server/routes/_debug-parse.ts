import { Router } from 'express';
import { generatePayloadSchema } from '../../shared/types/workouts';

const router = Router();

router.post('/api/_debug/parse', (req, res) => {
  try {
    const parsed = generatePayloadSchema.parse(req.body || {});
    return res.json({ ok: true, parsed });
  } catch (e: any) {
    return res.status(400).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
