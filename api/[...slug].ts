// api/[...slug].ts - Catch-all Vercel serverless function
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get the original path from Vercel's forwarded headers
    // Vercel populates these headers with the actual request path before rewriting
    const forwardedPath = 
      req.headers['x-vercel-forwarded-path'] as string || 
      req.headers['x-forwarded-uri'] as string ||
      req.url;
    
    // Preserve query string if present
    const queryString = forwardedPath?.includes('?') 
      ? forwardedPath.substring(forwardedPath.indexOf('?')) 
      : '';
    
    // Extract just the path (before query string)
    const originalPath = forwardedPath?.split('?')[0] || '/api';
    
    // Restore the original request URL so Express can match routes
    req.url = originalPath + queryString;
    (req as any).originalUrl = req.url;
    (req as any).path = originalPath;
    
    console.log(`[SERVERLESS] ${req.method} ${req.url} (forwarded: ${forwardedPath})`);
    
    // Import pre-compiled Express app
    const { default: expressApp } = await import('../server/app.js');
    
    // Pass request to Express
    return new Promise((resolve, reject) => {
      expressApp(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });
  } catch (error: any) {
    console.error('[SERVERLESS] Fatal error:', error);
    console.error('[SERVERLESS] Error stack:', error?.stack);
    
    return res.status(500).json({
      ok: false,
      error: {
        code: 'SERVERLESS_ERROR',
        message: error?.message || 'Internal server error',
        stack: error?.stack
      }
    });
  }
}

export const config = {
  maxDuration: 30,
};
