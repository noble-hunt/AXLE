import { createClient } from '@supabase/supabase-js'

export function admin() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export function userClient(token: string) {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_ANON_KEY!
  const client = createClient(url, key, { auth: { persistSession: false } })
  // Set the user's session for RLS
  client.auth.setSession({ access_token: token, refresh_token: '' })
  return client
}

export function bearer(req: { headers: Record<string, any> }) {
  const raw = (req.headers['authorization'] || req.headers['Authorization'] || '') as string
  return raw.replace(/^Bearer\s+/i, '')
}

export function validateEnvForUser() {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}