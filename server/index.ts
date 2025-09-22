// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startSuggestionsCron } from "./jobs/suggestions-cron";

// Server startup guard - ensure required environment variables are present
["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].forEach((k) => {
  if (!process.env[k]) throw new Error(`Missing required server env: ${k}`);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
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
  const port = parseInt(process.env.PORT || '5000', 10);

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
      log(`❌ Port ${port} is already in use. I'll try freeing it next time. You can also run "npm run kill" then "npm run dev".`);
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
