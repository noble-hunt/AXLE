// api/_supabase.ts  (Vercel serverless helpers)
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

// Environment validation
export function validateEnvForUser() {
  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is not set');
  }
  if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY is not set');
  }
}

// Admin client (uses service role key for admin operations)
export function admin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  
  return createClient(
    process.env.SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: { persistSession: false }
    }
  );
}

// User client (uses anon key with user's JWT token for RLS)
export function userClient(token: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { 
        headers: { 
          Authorization: `Bearer ${token}` 
        } 
      },
      auth: { persistSession: false }
    }
  );
}

// Extract Bearer token from request
export function bearer(req: VercelRequest): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No Bearer token found in Authorization header');
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

// Legacy helper for backwards compatibility
export const supabaseFromReq = (req: Request) =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    }
  );
