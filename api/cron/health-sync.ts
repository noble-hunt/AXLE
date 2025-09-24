// api/cron/health-sync.ts
// Call via Vercel Cron (Project → Settings → Cron Jobs)
// e.g., "0 5 * * *" (05:00 UTC) → GET https://<site>/api/cron/health-sync
import { supabaseAdmin } from '../_supabaseAdmin';
import { getProviderRegistry } from '../../server/providers/health';

export const config = { runtime: 'nodejs18.x' };

export default async function handler() {
  try {
    console.log('[CRON] Starting daily health sync...');
    
    const sb = supabaseAdmin;
    const registry = getProviderRegistry();
    const provs = Object.keys(registry).filter(p => p !== 'Mock');
    
    if (provs.length === 0) {
      console.log('[CRON] No real providers configured, skipping sync');
      return json({ skipped: true, reason: 'No real providers configured' });
    }

    console.log(`[CRON] Found ${provs.length} configured providers:`, provs);

    // Get all users with auth accounts
    const { data: authUsers, error: usersError } = await sb.auth.admin.listUsers();
    
    if (usersError) {
      console.error('[CRON] Failed to list users:', usersError);
      return json({ error: 'Failed to list users', details: usersError.message }, 500);
    }

    const users = authUsers?.users || [];
    console.log(`[CRON] Found ${users.length} total users`);

    // For each user and provider, try to sync
    const results: any[] = [];
    let syncCount = 0;
    let errorCount = 0;

    for (const user of users) {
      console.log(`[CRON] Processing user: ${user.id}`);
      
      for (const provider of provs) {
        try {
          // Check if user has connection for this provider
          const { data: connections } = await sb
            .from('wearable_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', provider)
            .eq('connected', true);

          if (!connections || connections.length === 0) {
            console.log(`[CRON] User ${user.id} not connected to ${provider}, skipping`);
            results.push({ 
              user: user.id, 
              provider, 
              status: 'skipped', 
              reason: 'not_connected' 
            });
            continue;
          }

          console.log(`[CRON] Syncing ${provider} for user ${user.id}`);

          // Call the existing sync endpoint internally
          const syncResponse = await fetch(`${process.env.VITE_SITE_URL || 'http://localhost:5000'}/api/health/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.id}`, // Use user ID as bearer token for internal calls
            },
            body: JSON.stringify({ provider })
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            results.push({ 
              user: user.id, 
              provider, 
              status: 'synced',
              result: syncResult
            });
            syncCount++;
            console.log(`[CRON] Successfully synced ${provider} for user ${user.id}`);
          } else {
            const errorText = await syncResponse.text();
            console.error(`[CRON] Failed to sync ${provider} for user ${user.id}:`, errorText);
            results.push({ 
              user: user.id, 
              provider, 
              status: 'error',
              error: errorText
            });
            errorCount++;
          }

        } catch (error) {
          console.error(`[CRON] Error syncing ${provider} for user ${user.id}:`, error);
          results.push({ 
            user: user.id, 
            provider, 
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
          errorCount++;
        }
      }
    }

    console.log(`[CRON] Completed daily health sync. Synced: ${syncCount}, Errors: ${errorCount}, Total operations: ${results.length}`);

    return json({ 
      success: true,
      summary: {
        users: users.length,
        providers: provs,
        synced: syncCount,
        errors: errorCount,
        total: results.length
      },
      results
    });

  } catch (error) {
    console.error('[CRON] Fatal error in health sync:', error);
    return json({ 
      error: 'Fatal error in health sync', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }

  function json(data: any, status: number = 200) { 
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' }
    }); 
  }
}