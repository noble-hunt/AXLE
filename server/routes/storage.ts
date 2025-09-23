// server/routes/storage.ts (Express dev)
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();

router.post('/group-photos/signed-upload', async (req, res) => {
  const { groupId, filename } = req.body ?? {};
  if (!groupId) return res.status(400).json({ error: 'groupId required' });
  
  const ext = String(filename || 'jpg').split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${groupId}/${crypto.randomUUID()}.${ext}`;
  
  const { data, error } = await supabaseAdmin.storage.from('group-photos').createSignedUploadUrl(path);
  if (error) return res.status(400).json({ error: error.message });
  
  res.json({ path, token: data.token, signedUrl: (data as any).signedUrl });
});

export default router;