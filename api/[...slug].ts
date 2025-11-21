// api/[...slug].ts - Catch-all Vercel serverless function
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
