import { Router } from 'express';
import os from 'os';
import pkg from '../../package.json' assert { type: 'json' };

const r = Router();
r.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'axle-api',
    version: pkg.version ?? '0.0.0',
    env: process.env.NODE_ENV || 'unknown',
    uptime_s: Math.round(process.uptime()),
    hostname: os.hostname(),
    time: new Date().toISOString()
  });
});

export default r;