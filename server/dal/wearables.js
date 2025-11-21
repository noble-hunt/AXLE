import { supabaseAdmin } from "../lib/supabaseAdmin.js";
export async function upsertWearable(params) {
    const { data, error } = await supabaseAdmin
        .from('wearable_connections')
        .upsert({
        user_id: params.userId,
        provider: params.provider,
        connected: params.connected,
        last_sync: params.lastSync,
        error: params.error,
        status: params.status || (params.connected ? 'connected' : 'disconnected')
    }, {
        onConflict: 'user_id,provider'
    })
        .select()
        .single();
    if (error) {
        throw new Error(`Failed to upsert wearable: ${error.message}`);
    }
    return data;
}
export async function listWearables(userId) {
    const { data, error } = await supabaseAdmin
        .from('wearable_connections')
        .select('*')
        .eq('user_id', userId);
    if (error) {
        throw new Error(`Failed to list wearables: ${error.message}`);
    }
    return data || [];
}
