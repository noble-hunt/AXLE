import { Request, Response, NextFunction } from 'express';
import { normalizeStyle } from '../lib/style';

export function normalizeStyleMiddleware(req: Request, res: Response, next: NextFunction) {
  const style = normalizeStyle((req.body as any)?.style ?? (req.body as any)?.goal ?? (req.body as any)?.focus);
  (req as any).body = { ...(req.body as any), style, goal: style, focus: style };
  res.setHeader('X-AXLE-Route', 'generate@normalizeStyle');
  res.setHeader('X-AXLE-Style-Normalized', style);
  next();
}
