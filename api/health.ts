// api/health.ts - Health tracking handler
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

    // POST /api/health/sync - Sync health data
    if (req.url?.includes('/sync') && req.method === 'POST') {
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

    // GET /api/health/reports - Get health reports
    if (req.url?.includes('/reports') && req.method === 'GET') {
      const days = parseInt(req.query.days as string) || 14;
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

    // GET /api/health/metrics - Get health metrics
    if (req.url?.includes('/metrics') && req.method === 'GET') {
      const days = parseInt(req.query.days as string) || 30;
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

    // GET /api/health/supabase - Health check
    if (req.url?.includes('/supabase') && req.method === 'GET') {
      return res.status(200).json({ status: 'ok', supabase: 'connected' });
    }

    return res.status(404).json({ message: 'Not Found' });
  } catch (error: any) {
    console.error('Health error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
