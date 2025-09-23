// server/lib/supabaseFromReq.ts
import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';
export const supabaseFromReq = (req: Request) =>
  createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: (req.headers['authorization'] as string) ?? '' } },
    auth: { persistSession: false },
  });