/**
 * JSON-only guard middleware to prevent HTML responses for API routes
 * Ensures that /api/* routes always return JSON and never fall through to SPA HTML
 */
export function requireJSON(req, res, next) {
    // Only apply to /api/* routes
    if (!req.path.startsWith('/api/')) {
        return next();
    }
    // Force JSON content type
    res.type('application/json');
    // Set Vary header to indicate response varies by Accept header
    res.setHeader('Vary', 'Accept');
    // Reject requests that explicitly only accept HTML (not JSON)
    const acceptHeader = req.headers.accept;
    if (acceptHeader && acceptHeader.includes('text/html') && !acceptHeader.includes('application/json') && !acceptHeader.includes('*/*')) {
        return res.status(406).json({
            error: 'Not Acceptable',
            message: 'This endpoint only supports JSON responses'
        });
    }
    // Continue processing - the route ordering in server/index.ts already ensures
    // API routes are handled before the SPA fallback, so this is mainly defensive
    return next();
}
