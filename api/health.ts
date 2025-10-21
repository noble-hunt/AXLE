// api/health.ts - Health tracking handler (action-based routing)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, userClient, bearer, validateEnvForUser } from '../lib/api-helpers/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  
  try {
    validateEnvForUser();
    
    const adminClient = admin();
    const token = bearer(req);
    const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = userData.user.id;
    const supa = userClient(token);

    // Action-based routing
    const action = req.body?.action || (req.method === 'GET' ? 'healthcheck' : 'sync');

    // ACTION: sync - Sync health data
    if (action === 'sync') {
      const { metrics, date } = req.body;
      if (!metrics || !date) {
        return res.status(400).json({ message: 'Metrics and date required' });
      }

      const { data, error } = await supa
        .from('health_reports')
        .upsert({
          user_id: userId,
          date: date,
          metrics: metrics,
          synced_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to sync health data:', error);
        return res.status(500).json({ message: 'Failed to sync health data' });
      }

      return res.status(200).json({ success: true, data });
    }

    // ACTION: reports - Get health reports
    if (action === 'reports') {
      const days = parseInt(req.body?.days as string) || 14;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supa
        .from('health_reports')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('Failed to fetch health reports:', error);
        return res.status(500).json({ message: 'Failed to fetch health reports' });
      }

      return res.status(200).json(data || []);
    }

    // ACTION: metrics - Get health metrics
    if (action === 'metrics') {
      const days = parseInt(req.body?.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supa
        .from('health_reports')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        console.error('Failed to fetch health metrics:', error);
        return res.status(500).json({ message: 'Failed to fetch health metrics' });
      }

      return res.status(200).json(data || []);
    }

    // ACTION: healthcheck - Health check (supabase connection test)
    if (action === 'healthcheck') {
      return res.status(200).json({ status: 'ok', supabase: 'connected' });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (error: any) {
    console.error('Health error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
