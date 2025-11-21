import type { Request, Response, NextFunction } from 'express';
import { GENERATOR_STAMP } from '../workoutGenerator.js';

export function jsonError(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err.statusCode || err.status || 500;
  const code   = err.code ? String(err.code).toLowerCase() : null;
  const msg    = String(err.message || 'unknown_error');
  const style  = String((req.body?.style || req.body?.goal || req.body?.focus || 'unknown')).toLowerCase();

  // Log once to the server console with a clear tag
  console.error('[AXLE][GEN][ERROR]', { status, code, msg, style, stamp: GENERATOR_STAMP });

  res.status(status).json({
    ok: false,
    error: msg,
    code,
    style,
    stamp: GENERATOR_STAMP,
    // allow clients/CLI to see acceptance/policy hints when available
    meta: {
      hint: err.hint || null,
      policy: err.policy || null,
      details: err.details || null,
    }
  });
}
