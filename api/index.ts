// api/index.ts - Vercel serverless function entry point
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import the Express app
let app: any = null;

async function getApp() {
  if (!app) {
    // Lazy load to optimize cold starts
    // Import without extension - Vercel resolves .ts in source, .js in build
    const { default: expressApp } = await import('../server/app');
    app = expressApp;
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await getApp();
    
    // Pass request directly to Express
    return new Promise((resolve, reject) => {
      expressApp(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });
  } catch (error: any) {
    console.error('[SERVERLESS] Fatal error:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'SERVERLESS_ERROR',
        message: error?.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      }
    });
  }
}

// Vercel configuration
export const config = {
  maxDuration: 30,
};
