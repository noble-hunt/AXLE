// server/routes/storage.ts (Express dev)
import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/requireAuth';
import { supabaseFromReq } from '../lib/supabaseFromReq';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

router.post('/group-photos/signed-upload', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { groupId, filename } = req.body ?? {};
    if (!groupId) return res.status(400).json({ error: 'groupId required' });
    if (!isUuid(groupId)) return res.status(400).json({ error: 'Invalid group id' });
    
    // Verify user is a member of the group
    const supabase = supabaseFromReq(req);
    const { data: membership, error: memberError } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', authReq.user.id)
      .single();
    
    if (memberError || !membership) {
      return res.status(403).json({ error: 'Access denied: not a group member' });
    }
    
    const ext = String(filename || 'jpg').split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${groupId}/${crypto.randomUUID()}.${ext}`;
    
    const { data, error } = await supabaseAdmin.storage.from('group-photos').createSignedUploadUrl(path);
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ path, token: data.token, signedUrl: (data as any).signedUrl });
  } catch (error) {
    console.error('Storage signed upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;