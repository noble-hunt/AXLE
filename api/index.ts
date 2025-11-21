// api/index.ts - Vercel serverless function entry point
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Dynamic import to handle cases where server/app.js might not be built yet
    const { default: expressApp } = await import('../server/app.js');
    
    // Pass request directly to Express
    return new Promise((resolve, reject) => {
      expressApp(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });
  } catch (error: any) {
    console.error('[SERVERLESS] Fatal error:', error);
    console.error('[SERVERLESS] Error stack:', error?.stack);
    console.error('[SERVERLESS] Current directory:', process.cwd());
    
    return res.status(500).json({
      ok: false,
      error: {
        code: 'SERVERLESS_ERROR',
        message: error?.message || 'Internal server error',
        stack: error?.stack,
        cwd: process.cwd()
      }
    });
  }
}

// Vercel configuration
export const config = {
  maxDuration: 30,
};
