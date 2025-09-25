// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startSuggestionsCron } from "./jobs/suggestions-cron";
import { initSentry, Sentry } from "./sentry";
import { logging } from "./middleware/logging";
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
["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].forEach((k) => {
  if (!process.env[k]) throw new Error(`Missing required server env: ${k}`);
});

const app = express();

// Sentry request handler (must be first middleware)
if (Sentry.Handlers) {
  app.use(Sentry.Handlers.requestHandler());
}

// Structured logging with correlation IDs
app.use(logging);
app.use((req, _res, next) => { 
  req.headers["x-request-id"] ||= (req as any).id; 
  next(); 
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
  const server = await registerRoutes(app);

  // Sentry error handler (must be before other error handlers)
  if (Sentry.Handlers) {
    app.use(Sentry.Handlers.errorHandler());
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Add request ID to response headers
    res.setHeader('x-request-id', (req as any).id);
    
    // Add request ID to Sentry context
    if (typeof Sentry?.setTag === 'function') {
      Sentry.setTag('request_id', (req as any).id);
    }
    
    // For non-API routes that error, serve 500.html
    if (status === 500 && !req.path.startsWith('/api')) {
      return res.status(500).sendFile('500.html', { root: 'client/public' });
    }
    
    // For API routes, return JSON error
    res.status(status).json({ message });
    
    // Log the error (don't rethrow to avoid process crashes)
    console.error(`Error ${status} on ${req.method} ${req.path}:`, err);
  });

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
