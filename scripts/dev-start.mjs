// scripts/dev-start.mjs
import kill from 'kill-port';
import { spawn } from 'node:child_process';

const port = parseInt(process.env.PORT || '5000', 10);

(async () => {
  try {
    await kill(port, 'tcp');   // free the port if something is already bound
  } catch {
    // nothing was listening; ignore
  }

  const child = spawn('tsx', ['server/index.ts'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  child.on('exit', code => process.exit(code ?? 0));
})();