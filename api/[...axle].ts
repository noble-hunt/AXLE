// api/[...axle].ts - Catch-all serverless function for Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';

// Lazy import to avoid loading Express app during cold start
let handler: any = null;

async function getHandler() {
  if (!handler) {
    const { default: expressApp } = await import('../server/app');
    handler = serverless(expressApp, {
      provider: 'aws',
    });
  }
  return handler;
}

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    // Pass request through unchanged - Express routes are defined as /api/*
    const serverlessHandler = await getHandler();
    return serverlessHandler(req, res);
  } catch (error: any) {
    console.error('[SERVERLESS] Fatal error:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'SERVERLESS_ERROR',
        message: error?.message || 'Internal server error'
      }
    });
  }
}

// Vercel configuration
export const config = {
  maxDuration: 30,
};
