import { Router } from 'express';
import { generatePayloadSchema } from '../../shared/types/workouts.js';
const router = Router();
router.post('/api/_debug/parse', (req, res) => {
    try {
        const parsed = generatePayloadSchema.parse(req.body || {});
        return res.json({ ok: true, parsed });
    }
    catch (e) {
        return res.status(400).json({ ok: false, error: e?.message || String(e) });
    }
});
export default router;
