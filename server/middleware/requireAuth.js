import { supabaseAdmin } from "../lib/supabaseAdmin.js";
export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or invalid authorization header' });
            return;
        }
        const token = authHeader.substring(7);
        const { data: user, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user?.user) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        // Attach user data to request
        req.user = {
            id: user.user.id,
            email: user.user.email || ''
        };
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
}
