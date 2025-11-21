import { supabaseAdmin } from '../lib/supabaseAdmin.js';
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authorization token required' });
        return;
    }
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email
        };
        next();
    }
    catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ message: 'Authentication failed' });
    }
}
// Admin middleware - checks if user is admin based on email
export async function requireAdmin(req, res, next) {
    // First check authentication
    await new Promise((resolve, reject) => {
        requireAuth(req, res, (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
    const authReq = req;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim());
    if (!adminEmails.includes(authReq.user.email || '')) {
        res.status(403).json({ message: 'Admin access required' });
        return;
    }
    next();
}
