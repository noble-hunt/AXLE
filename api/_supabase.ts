import { createClient } from '@supabase/supabase-js'

export function admin() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export function bearer(req: { headers: Record<string, any> }) {
  const raw = (req.headers['authorization'] || req.headers['Authorization'] || '') as string
  return raw.replace(/^Bearer\s+/i, '')
}