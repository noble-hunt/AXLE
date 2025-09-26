import { pool } from '../db';

/**
 * Boot-time migration guard to ensure critical database schema exists.
 * These are fail-safe migrations that can run multiple times without issues.
 * If migration tooling is unavailable, this ensures core functionality works.
 */
export async function runBootMigrationGuard(): Promise<void> {
  try {
    console.log('[MIGRATION GUARD] Starting boot-time schema validation...');
    
    // Ensure workouts.started_at column exists
    // This is idempotent - IF NOT EXISTS prevents errors if column already exists
    await pool.query(`
      ALTER TABLE workouts 
      ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
    `);
    
    console.log('[MIGRATION GUARD] ✓ workouts.started_at column ensured');
    console.log('[MIGRATION GUARD] Boot-time schema validation completed successfully');
    
  } catch (error: any) {
    // Log error but don't crash the server - this is a fail-safe mechanism
    console.error('[MIGRATION GUARD] ❌ Failed to run boot migration guard:', error.message);
    console.warn('[MIGRATION GUARD] ⚠️  Server starting with potential schema issues - some features may not work correctly');
    
    // Only throw if it's a critical connection error that would affect the entire app
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Database connection failed during boot migration guard: ${error.message}`);
    }
  }
}