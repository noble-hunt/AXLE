// server/lib/supabaseFromReq.ts  (Express dev, caller's JWT)
import { createClient } from '@supabase/supabase-js';
export const supabaseFromReq = (req) => createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers['authorization'] ?? '' } },
    auth: { persistSession: false },
});
