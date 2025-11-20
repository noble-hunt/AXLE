// build-server.js - Bundle server/app.ts for Vercel deployment
const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: ['server/app.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',  // Use ESM to preserve import.meta
  outfile: 'dist-server/app.js',
  external: [
    // Keep node_modules external - Vercel bundles these automatically
    'express',
    'cors',
    '@supabase/supabase-js',
    '@neondatabase/serverless',
    'drizzle-orm',
    'openai',
    'zod',
    'dotenv',
    '@sentry/node',
    'pino-http',
    'multer',
    'qrcode',
    'web-push',
    'jsonwebtoken',
    'bcryptjs',
    'node-cron',
    'ws'
  ],
  sourcemap: true,
  minify: false, // Keep readable for debugging
  banner: {
    // Add shim for __dirname and __filename in ESM
    js: "import { createRequire as topLevelCreateRequire } from 'module';\nconst require = topLevelCreateRequire(import.meta.url);\nimport { fileURLToPath as topLevelFileURLToPath } from 'url';\nimport { dirname as topLevelDirname } from 'path';\nconst __filename = topLevelFileURLToPath(import.meta.url);\nconst __dirname = topLevelDirname(__filename);"
  },
  loader: {
    '.json': 'json',
  },
}).then(() => {
  console.log('✅ Server bundle built successfully: dist-server/app.js');
  
  // Copy JSON assets and data files to dist-server
  const fs = require('fs');
  const copyDir = (src, dest) => {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };
  
  // Copy workout library blocks directly to dist-server/blocks/
  // The bundled code resolves __dirname to dist-server/, so blocks must be at dist-server/blocks/
  if (fs.existsSync('server/workouts/library/blocks')) {
    copyDir('server/workouts/library/blocks', 'dist-server/blocks');
    console.log('✅ Copied workout library blocks to dist-server/blocks/');
  }
  
  // Note: Movement registry and other JSON imports are bundled by esbuild, no copy needed
  
}).catch((err) => {
  console.error('❌ Server bundle failed:', err);
  process.exit(1);
});
