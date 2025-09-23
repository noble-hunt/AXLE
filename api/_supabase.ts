// api/_supabase.ts  (Vercel serverless uses caller's JWT)
import { createClient } from '@supabase/supabase-js';
export const supabaseFromReq = (req: Request) =>
  createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });