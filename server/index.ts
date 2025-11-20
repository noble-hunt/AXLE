// server/index.ts
import './config/env';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { registerRoutes } from "./routes";
import { workouts } from "./routes/workouts";
import { setupVite, serveStatic, log } from "./vite";
import { startSuggestionsCron } from "./jobs/suggestions-cron";
import { initSentry, Sentry } from "./sentry";
import { logging } from "./middleware/logging";
import { jsonError } from "./middleware/error";
import { runBootMigrationGuard } from "./migrations/boot-guard";
import { ensureStorageBuckets } from "./lib/initStorage";
import fs from 'node:fs';
import path from 'node:path';

// Use deterministic path that doesn't depend on cwd
const pidFile = path.resolve(import.meta.dirname, '../.dev-server.pid');

const waitForPidExit = (pid: number, maxWait: number = 2000) => {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const check = () => {
      try {
        process.kill(pid, 0); // Check if process exists
        if (Date.now() - start < maxWait) {
          setTimeout(check, 50);
        } else {
          resolve(); // Timeout, proceed anyway
        }
      } catch {
        resolve(); // Process doesn't exist
      }
    };
    check();
  });
};

(async () => {
  try {
    console.log(`[PID] Using PID file: ${pidFile}`);
    
    // if a stale PID exists, try to terminate it and wait
    if (fs.existsSync(pidFile)) {
      const oldPid = Number(fs.readFileSync(pidFile, 'utf8').trim());
      if (oldPid && oldPid !== process.pid) {
        console.log(`[PID] Terminating stale process ${oldPid}`);
        try { 
          process.kill(oldPid, 'SIGTERM'); 
          await waitForPidExit(oldPid, 1000);
          try { process.kill(oldPid, 'SIGKILL'); } catch {}
          await waitForPidExit(oldPid, 500);
        } catch {}
      }
      fs.rmSync(pidFile, { force: true });
    }
    
    fs.writeFileSync(pidFile, String(process.pid));
    console.log(`[PID] Written PID ${process.pid} to ${pidFile}`);
    
    const cleanup = () => { 
      try { 
        fs.rmSync(pidFile, { force: true }); 
        console.log(`[PID] Cleaned up PID file`);
      } catch {} 
    };
    
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  } catch (error) {
    console.warn(`[PID] Failed to manage PID file:`, error);
  }
})();

// Initialize Sentry error tracking
initSentry();

// Server startup guard - ensure required environment variables are present
const criticalEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const importantEnvVars = [
  "DATABASE_URL" // Required for groups and advanced features
];

const missingCritical = criticalEnvVars.filter(k => !process.env[k]);
const missingImportant = importantEnvVars.filter(k => !process.env[k]);

if (missingCritical.length > 0) {
  const errorMsg = `
╔════════════════════════════════════════════════════════════════╗
║ FATAL: Missing Critical Environment Variables                 ║
╠════════════════════════════════════════════════════════════════╣
║ The following CRITICAL environment variables are missing:     ║
║ ${missingCritical.map(v => `• ${v}`).join('\n║ ')}                                ║
║                                                                ║
║ For Vercel deployment:                                        ║
║ 1. Go to your Vercel project settings                         ║
║ 2. Navigate to: Settings → Environment Variables              ║
║ 3. Add the missing variables for Production environment       ║
║ 4. Redeploy your application                                  ║
║                                                                ║
║ Get these values from your Supabase project settings          ║
╚════════════════════════════════════════════════════════════════╝
  `.trim();
  
  console.error(errorMsg);
  throw new Error(`Missing critical environment variables: ${missingCritical.join(', ')}`);
}

if (missingImportant.length > 0) {
  const warnMsg = `
╔════════════════════════════════════════════════════════════════╗
║ WARNING: Missing Important Environment Variables              ║
╠════════════════════════════════════════════════════════════════╣
║ The following IMPORTANT environment variables are missing:    ║
║ ${missingImportant.map(v => `• ${v}`).join('\n║ ')}                                ║
║                                                                ║
║ Some features may be limited:                                 ║
║ • Groups functionality requires DATABASE_URL                  ║
║ • Advanced analytics require DATABASE_URL                     ║
║                                                                ║
║ See PRODUCTION_DEPLOYMENT.md for setup instructions           ║
╚════════════════════════════════════════════════════════════════╝
  `.trim();
  
  console.warn(warnMsg);
}

const app = express();

// Sentry request handler (must be first middleware)
// Note: Sentry Handlers may be version-specific, commenting out for now
// if (Sentry.Handlers) {
//   app.use(Sentry.Handlers.requestHandler());
// }

// CORS configuration
const allowed = [
  /^https?:\/\/.*\.replit\.dev$/,   // Replit preview tabs
  "http://localhost:5173",          // local Vite
  "https://axle-ebon.vercel.app"    // production web (adjust if different)
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowed.some((a) => a instanceof RegExp ? a.test(origin) : a === origin)) {
      return cb(null, true);
    }
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Structured logging with correlation IDs
app.use(logging);
app.use((req, _res, next) => { 
  req.headers["x-request-id"] ||= (req as any).id; 
  next(); 
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Add request ID to response headers
  res.setHeader('x-request-id', (req as any).id);

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms [${(req as any).id}]`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// Mount the workouts router
app.use("/api/workouts", workouts);

// TEMP route index for debugging
app.get("/api/_routes", (req, res) => {
  res.json({
    ok: true,
    routes: [
      "POST /api/workouts/preview",
      "POST /api/workouts/generate/preview (alias)"
    ]
  });
});

(async () => {
  // Run boot-time migration guard to ensure critical schema exists
  // await runBootMigrationGuard(); // Disabled: Not applicable for local PostgreSQL database
  
  // Ensure storage buckets exist
  await ensureStorageBuckets();
  
  const server = await registerRoutes(app);

  // Sentry error handler (must be before other error handlers)
  // Note: Sentry Handlers may be version-specific, commenting out for now
  // if (Sentry.Handlers) {
  //   app.use(Sentry.Handlers.errorHandler());
  // }

  // JSON error middleware - ensures all errors return structured JSON (never null)
  app.use(jsonError);

  // Dev uses Vite middleware (with real config). Prod serves static build.
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start cron jobs if enabled (default enabled in development)
  const shouldEnableCron =
    process.env.SUGGESTIONS_CRON === "true" ||
    (process.env.NODE_ENV === "development" &&
      process.env.SUGGESTIONS_CRON !== "false");

  if (shouldEnableCron && process.env.NODE_ENV !== "test") {
    startSuggestionsCron();
    log("⏰ Suggestions cron job enabled");
  } else {
    log(
      "⏰ Suggestions cron job disabled (SUGGESTIONS_CRON not set to 'true' or in test mode)",
    );
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const detectedPort = process.env.PORT && /^\d+$/.test(process.env.PORT) ? Number(process.env.PORT) : (process.env.REPL_ID ? 8000 : 5000);
  const port = detectedPort;
  
  log(`[PORT] Using env PORT=${process.env.PORT ?? '∅'} → listening on ${port}`);

  const httpServer = server.listen(
    {
      port,
      host: '0.0.0.0'
      // reusePort intentionally omitted to avoid conflicts in dev
    },
    () => {
      log(`serving on port ${port}`);
    }
  );

  // Helpful diagnostics for "address already in use"
  httpServer.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      log(`❌ Port ${port} is already in use. Run "npx kill-port ${port}" then try again.`);
      process.exit(1);
    }
    throw err;
  });

  // Graceful shutdown so port is freed on stop/restart
  const shutdown = (signal: string) => () => {
    log(`Received ${signal}, closing server...`);
    httpServer.close(() => {
      log('Server closed. Bye!');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
})();
