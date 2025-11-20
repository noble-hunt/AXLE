// api/_supabase.ts  (Vercel serverless helpers)
import { createClient } from '@supabase/supabase-js';
// Environment validation - validates all required Supabase environment variables
export function validateEnvForUser() {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
// Admin client (uses service role key for admin operations)
export function admin() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }
    return createClient(process.env.SUPABASE_URL, serviceRoleKey, {
        auth: { persistSession: false }
    });
}
// User client (uses anon key with user's JWT token for RLS)
export function userClient(token) {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        },
        auth: { persistSession: false }
    });
}
// Extract Bearer token from request - returns null if not found (caller should handle 401)
export function bearer(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return '';
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
}
// Legacy helper for backwards compatibility
export const supabaseFromReq = (req) => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
});
