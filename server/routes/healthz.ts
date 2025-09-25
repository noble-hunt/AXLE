import { Router } from 'express';
import os from 'node:os';

export const router = Router();

router.get('/', (_req, res) => {
  res.type('application/json').status(200).send({
    ok: true,
    service: 'axle-api',
    node: process.version,
    uptime: process.uptime(),
    host: os.hostname(),
    env: process.env.NODE_ENV || 'dev',
    timestamp: new Date().toISOString(),
  });
});