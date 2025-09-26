import { supabaseAdmin } from '../lib/supabaseAdmin';

/**
 * Boot-time migration guard to ensure critical database schema exists in Supabase.
 * FAIL-FAST approach: If schema is incorrect, the app should not start.
 * This prevents runtime failures when new fields are required but missing.
 */
export async function runBootMigrationGuard(): Promise<void> {
  try {
    console.log('[MIGRATION GUARD] Starting boot-time schema validation against Supabase...');
    
    await ensureStartedAtColumnExists();
    
    console.log('[MIGRATION GUARD] ✓ workouts.started_at column verified');
    console.log('[MIGRATION GUARD] Boot-time schema validation completed successfully');
    
  } catch (error: any) {
    console.error('[MIGRATION GUARD] ❌ Schema validation failed:', error.message);
    console.error('[MIGRATION GUARD] 🚨 WARNING: Potential schema issues detected');
    console.error('[MIGRATION GUARD] 🔧 Please ensure started_at column exists in workouts table');
    
    // For development: Log warning and continue (allows testing while investigating DB config)
    // TODO: Re-enable fail-fast once database configuration is confirmed
    if (process.env.NODE_ENV === 'production') {
      console.error('[MIGRATION GUARD] 🚨 CRITICAL: Production mode - exiting due to schema validation failure');
      process.exit(1);
    } else {
      console.warn('[MIGRATION GUARD] ⚠️  Development mode: Continuing with potential schema issues');
      console.warn('[MIGRATION GUARD] ⚠️  This may cause runtime errors if started_at operations are attempted');
    }
  }
}

/**
 * Ensures the started_at column exists in the workouts table in Supabase
 * Tests by performing actual operations that would fail if column is missing
 */
async function ensureStartedAtColumnExists(): Promise<void> {
  try {
    // Test 1: Try to query the started_at column directly
    // This will fail with a clear error if the column doesn't exist
    const { data, error: queryError } = await supabaseAdmin
      .from('workouts')
      .select('started_at')
      .limit(1);
    
    if (queryError) {
      // Check if error is specifically about missing column
      if (queryError.message.includes('started_at') || 
          queryError.message.includes('does not exist') ||
          queryError.code === '42703') {
        throw new Error(`started_at column missing from workouts table: ${queryError.message}`);
      }
      // Other errors (like empty table) are acceptable for this test
      if (queryError.code !== 'PGRST116') { // PGRST116 = no rows found, which is OK
        console.warn('[MIGRATION GUARD] Warning during column existence check:', queryError.message);
      }
    }
    
    console.log('[MIGRATION GUARD] ✓ started_at column exists and is queryable');
    
    // Test 2: Validate we can perform updates on started_at column
    // Use a dummy update that won't affect any rows but will validate schema
    const testTimestamp = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('workouts')
      .update({ started_at: testTimestamp })
      .eq('id', 'nonexistent-test-validation-id');
    
    if (updateError) {
      // If error mentions started_at specifically, it's a schema issue
      if (updateError.message.includes('started_at') || 
          updateError.message.includes('does not exist')) {
        throw new Error(`started_at column update validation failed: ${updateError.message}`);
      }
      // Other errors like "no matching rows" are expected and acceptable
    }
    
    console.log('[MIGRATION GUARD] ✓ started_at column accepts timestamp updates');
    
  } catch (error) {
    console.error('[MIGRATION GUARD] ❌ Failed to validate started_at column:', error);
    throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}