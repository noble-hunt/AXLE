import { Router } from 'express';
import os from 'node:os';
import { pool } from '../db.js';

export const router = Router();

router.get('/', async (_req, res) => {
  // Check critical environment variables (without exposing values)
  const checkEnvVar = (name: string): 'configured' | 'missing' => {
    return process.env[name] ? 'configured' : 'missing';
  };

  // Categorize environment variables by importance
  const criticalVars = {
    SUPABASE_URL: checkEnvVar('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: checkEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    DATABASE_URL: checkEnvVar('DATABASE_URL'),
  };

  const requiredVars = {
    VITE_SUPABASE_URL: checkEnvVar('VITE_SUPABASE_URL'),
    VITE_SUPABASE_ANON_KEY: checkEnvVar('VITE_SUPABASE_ANON_KEY'),
    SUPABASE_ANON_KEY: checkEnvVar('SUPABASE_ANON_KEY'),
  };

  const importantVars = {
    OPENAI_API_KEY: checkEnvVar('OPENAI_API_KEY'),
  };

  const optionalVars = {
    // Email & Error Tracking
    RESEND_API_KEY: checkEnvVar('RESEND_API_KEY'),
    SENTRY_DSN_SERVER: checkEnvVar('SENTRY_DSN_SERVER'),
    SENTRY_ENV: checkEnvVar('SENTRY_ENV'),
    
    // Alternative AI Providers
    AZURE_OPENAI_API_KEY: checkEnvVar('AZURE_OPENAI_API_KEY'),
    MODEL_API_KEY: checkEnvVar('MODEL_API_KEY'),
    
    // Health Providers (require BOTH ID and SECRET)
    OURA_CLIENT_ID: checkEnvVar('OURA_CLIENT_ID'),
    OURA_CLIENT_SECRET: checkEnvVar('OURA_CLIENT_SECRET'),
    FITBIT_CLIENT_ID: checkEnvVar('FITBIT_CLIENT_ID'),
    FITBIT_CLIENT_SECRET: checkEnvVar('FITBIT_CLIENT_SECRET'),
    GARMIN_CLIENT_ID: checkEnvVar('GARMIN_CLIENT_ID'),
    GARMIN_CLIENT_SECRET: checkEnvVar('GARMIN_CLIENT_SECRET'),
    GARMIN_REDIRECT_URL: checkEnvVar('GARMIN_REDIRECT_URL'),
    WHOOP_CLIENT_ID: checkEnvVar('WHOOP_CLIENT_ID'),
    WHOOP_CLIENT_SECRET: checkEnvVar('WHOOP_CLIENT_SECRET'),
    
    // Site Configuration
    VITE_SITE_URL: checkEnvVar('VITE_SITE_URL'),
    SITE_URL: checkEnvVar('SITE_URL'),
    
    // Admin
    ADMIN_EMAILS: checkEnvVar('ADMIN_EMAILS'),
  };

  const featureFlags = {
    HOBH_FORCE_PREMIUM: checkEnvVar('HOBH_FORCE_PREMIUM'),
    AXLE_DISABLE_SIMPLE: checkEnvVar('AXLE_DISABLE_SIMPLE'),
    AXLE_DISABLE_MOCK: checkEnvVar('AXLE_DISABLE_MOCK'),
    HOBH_PREMIUM_NOTES_MODE: checkEnvVar('HOBH_PREMIUM_NOTES_MODE'),
    HOBH_PREMIUM_STRICT: checkEnvVar('HOBH_PREMIUM_STRICT'),
  };

  // Count missing variables by category
  const missingCritical = Object.entries(criticalVars)
    .filter(([_, status]) => status === 'missing')
    .map(([name]) => name);
  
  const missingRequired = Object.entries(requiredVars)
    .filter(([_, status]) => status === 'missing')
    .map(([name]) => name);
  
  const missingImportant = Object.entries(importantVars)
    .filter(([_, status]) => status === 'missing')
    .map(([name]) => name);

  // Initialize warnings array
  const warnings: string[] = [];

  // Test database connectivity
  let dbStatus: 'healthy' | 'unhealthy' | 'unconfigured' = 'unconfigured';
  let dbMessage = '';
  let dbError = null;
  
  if (process.env.DATABASE_URL) {
    try {
      const dbTest = await pool.query('SELECT NOW() as current_time');
      dbStatus = 'healthy';
      dbMessage = `Connected - server time: ${dbTest.rows[0]?.current_time}`;
    } catch (error) {
      dbStatus = 'unhealthy';
      dbMessage = 'Connection failed';
      dbError = error instanceof Error ? error.message : String(error);
      warnings.push(`❌ Database connection failed: ${dbError}`);
    }
  } else {
    dbStatus = 'unconfigured';
    dbMessage = 'DATABASE_URL not configured';
  }

  // Determine overall health status
  let status: 'healthy' | 'degraded' | 'critical';

  if (missingCritical.length > 0 || dbStatus === 'unhealthy') {
    status = 'critical';
    if (missingCritical.length > 0) {
      warnings.push(`❌ CRITICAL: ${missingCritical.length} critical variable(s) missing - app may crash: ${missingCritical.join(', ')}`);
    }
  } else if (missingRequired.length > 0 || dbStatus === 'unconfigured') {
    status = 'degraded';
    if (missingRequired.length > 0) {
      warnings.push(`⚠️ ${missingRequired.length} required variable(s) missing - core features unavailable: ${missingRequired.join(', ')}`);
    }
  } else if (missingImportant.length > 0) {
    status = 'degraded';
    warnings.push(`⚠️ ${missingImportant.length} important variable(s) missing - some features limited: ${missingImportant.join(', ')}`);
  } else {
    status = 'healthy';
  }

  res.type('application/json').status(200).send({
    ok: status !== 'critical',
    service: 'axle-api',
    node: process.version,
    uptime: process.uptime(),
    host: os.hostname(),
    env: process.env.NODE_ENV || 'dev',
    timestamp: new Date().toISOString(),
    environment: {
      status,
      variables: {
        critical: criticalVars,
        required: requiredVars,
        important: importantVars,
        optional: optionalVars,
        featureFlags: featureFlags,
      },
      missing: {
        critical: missingCritical,
        required: missingRequired,
        important: missingImportant,
      },
      warnings
    },
    database: {
      status: dbStatus,
      message: dbMessage,
      ...(dbError && { error: dbError })
    }
  });
});