import { normalizeStyle } from '../lib/style.js';
export function normalizeStyleMiddleware(req, res, next) {
    const originalBody = { ...req.body };
    const style = normalizeStyle(req.body?.style ?? req.body?.goal ?? req.body?.focus);
    req.body = { ...req.body, style, goal: style, focus: style };
    console.log('[MIDDLEWARE]', {
        original: { style: originalBody.style, goal: originalBody.goal, focus: originalBody.focus },
        normalized: style,
        final: { style, goal: style, focus: style }
    });
    res.setHeader('X-AXLE-Route', 'generate@normalizeStyle');
    res.setHeader('X-AXLE-Style-Normalized', style);
    next();
}
