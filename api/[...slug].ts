// api/[...slug].ts - Catch-all Vercel serverless function
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Extract slug from Vercel's query params
    const slug = req.query.slug as string[] | string | undefined;
    const slugPath = Array.isArray(slug) ? slug.join('/') : (slug || '');
    
    // Reconstruct the full path for Express
    const fullPath = `/api/${slugPath}`;
    
    // Restore the original request URL so Express can match routes
    req.url = fullPath + (req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
    (req as any).originalUrl = req.url;
    
    console.log(`[SERVERLESS] Request: ${req.method} ${req.url}`);
    
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
