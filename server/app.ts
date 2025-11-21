// server/app.ts - Express app configuration for Vercel serverless
import './config/env.js';
import express from "express";
import cors from 'cors';
import { workouts } from "./routes/workouts.js";
import { initSentry } from "./sentry.js";
import { logging } from "./middleware/logging.js";
import { jsonError } from "./middleware/error.js";
import { initializeBlockLibrary } from "./workouts/library/index.js";
import { registerRoutes } from "./routes.js";
import { registerSuggestionRoutes } from "./routes/suggestions.js";
import workoutFreeformRouter from "./routes/workout-freeform.js";
import whisperRouter from "./routes/whisper-transcription.js";
import { registerGroupRoutes } from "./routes/groups.js";
import { registerWorkoutGenerationRoutes } from "./routes/workout-generation.js";
import { registerSeedRoutes } from "./routes/workout-seeds.js";
import { registerSimulateRoutes } from "./routes/workout-simulate.js";
import { registerGenerateRoutes } from "./routes/workout-generate.js";
import { registerWorkoutSuggestionRoutes } from "./routes/workout-suggest.js";
import healthRoutes from "./routes/health.js";
import healthMetricsRouter from "./routes/health-metrics.js";
import pushNativeRouter from "./routes/push-native.js";
import pushRouter from "./routes/push.js";
import notificationPrefsRouter from "./routes/notification-prefs.js";
import notificationTopicsRouter from "./routes/notifications-topics.js";
import cronWeeklyRouter from "./routes/cron-weekly.js";
import storageRouter from "./routes/storage.js";
import { router as healthzRouter } from "./routes/healthz.js";
import { suggest } from "./routes/suggest.js";
import debugStyleRouter from "./routes/_debug-style.js";
import debugTraceRouter from "./routes/_debug-trace.js";
import debugParseRouter from "./routes/_debug-parse.js";
import debugAiRouter from "./routes/_debug-ai.js";

// Initialize Sentry error tracking
initSentry();

// Server startup guard - ensure required environment variables are present
const criticalEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL"
];

const importantEnvVars = [
  "OPENAI_API_KEY" // Required for workout generation
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

// CORS configuration
const allowed = [
  /^https?:\/\/.*\.replit\.dev$/,   // Replit preview tabs
  /^https?:\/\/.*\.vercel\.app$/,    // Vercel deployments
  "http://localhost:5173",          // local Vite
  "https://axle-ebon.vercel.app"    // production web
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
      console.log(logLine);
    }
  });

  next();
});

// Initialize workout block library
initializeBlockLibrary();

// Register legacy REST routes (includes POST /api/profiles, POST /api/prs, etc.)
// CRITICAL: Must be called to register all routes from server/routes.ts
// Note: registerRoutes is async but registers routes synchronously
registerRoutes(app);

// Debug routes
app.use(debugStyleRouter);
app.use(debugTraceRouter);
app.use(debugParseRouter);
app.use(debugAiRouter);

// Mount the workouts router
app.use("/api/workouts", workouts);

// Register all other routes
registerSuggestionRoutes(app);
app.use(workoutFreeformRouter);
app.use(whisperRouter);
registerGroupRoutes(app);
registerWorkoutGenerationRoutes(app);
registerSeedRoutes(app);
registerSimulateRoutes(app);
registerGenerateRoutes(app);
registerWorkoutSuggestionRoutes(app);
app.use(healthRoutes);
app.use(healthMetricsRouter);
app.use(pushNativeRouter);
app.use(pushRouter);
app.use(notificationPrefsRouter);
app.use(notificationTopicsRouter);
app.use(cronWeeklyRouter);
app.use(storageRouter);
app.use(healthzRouter);
app.use(suggest);

// API 404 handler - must be after all API routes
app.use('/api/*', (req, res) => {
  res.type('application/json');
  res.status(404).json({ 
    ok: false, 
    error: { code: 'NOT_FOUND', message: `API endpoint ${req.path} not found` } 
  });
});

// JSON error middleware - ensures all errors return structured JSON (never null)
app.use(jsonError);

export default app;
