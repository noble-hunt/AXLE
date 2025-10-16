#!/usr/bin/env node
// scripts/dev-start.mjs
// Clean restart helper - kills stale processes and starts fresh

import { spawn } from 'child_process';

console.log('[DEV] Starting server with clean state...');

const p = spawn('tsx', ['server/index.ts'], { 
  stdio: 'inherit', 
  env: process.env 
});

p.on('exit', (code) => {
  console.log(`[DEV] Server exited with code ${code}`);
  process.exit(code || 0);
});

p.on('error', (err) => {
  console.error('[DEV] Failed to start server:', err);
  process.exit(1);
});
