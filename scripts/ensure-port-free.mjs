// scripts/ensure-port-free.mjs
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Make kill-port optional to handle environments where it's not installed
let kill = null;
try {
  const killModule = await import('kill-port');
  kill = killModule.default;
} catch {
  console.log('kill-port not available, using system tools fallbacks');
}

const port = Number(process.env.PORT || 8000);
const pidFile = path.resolve(process.cwd(), '.dev-server.pid');

const tryExec = (cmd) => {
  try { return execSync(cmd, { stdio: 'pipe' }).toString(); }
  catch { return ''; }
};

const tryKillPid = (pid, signal='SIGTERM') => {
  if (!pid) return;
  try { process.kill(Number(pid), signal); } catch {}
};

(async () => {
  // 0) Kill a prior PID we recorded (if still alive)
  try {
    if (fs.existsSync(pidFile)) {
      const oldPid = Number(fs.readFileSync(pidFile, 'utf8').trim());
      if (oldPid && oldPid !== process.pid) {
        tryKillPid(oldPid, 'SIGTERM');
        // small wait then SIGKILL if needed
        await new Promise(r => setTimeout(r, 200));
        tryKillPid(oldPid, 'SIGKILL');
      }
      fs.rmSync(pidFile, { force: true });
    }
  } catch {}

  // 1) kill-port (generic) - only if available
  if (kill) {
    try { await kill(port, 'tcp'); } catch {}
  }

  // 2) fuser fallback (Linux)
  tryExec(`fuser -k ${port}/tcp`);

  // 3) ss parse & kill fallback
  const ssOut = tryExec(`ss -lptn 'sport = :${port}'`);
  const pids = [...ssOut.matchAll(/pid=(\d+)/g)].map(m => Number(m[1]));
  for (const pid of pids) {
    tryKillPid(pid, 'SIGTERM');
    await new Promise(r => setTimeout(r, 200));
    tryKillPid(pid, 'SIGKILL');
  }

  // 4) Pattern kill of our dev server if any remains
  tryExec(`pkill -f "tsx server/index.ts"`);
  tryExec(`pkill -f "node.*server/index.ts"`);

  // 5) Final double-check with kill-port (if available)
  if (kill) {
    try { await kill(port, 'tcp'); } catch {}
  }

  // Now spawn the dev runner so this script acts like "npm run dev"
  // Since package.json can't be modified, call tsx directly
  const child = spawn('tsx', ['server/index.ts'], { 
    stdio: 'inherit', 
    shell: true, 
    env: { ...process.env, NODE_ENV: 'development' }
  });
  child.on('exit', code => process.exit(code ?? 0));
})();