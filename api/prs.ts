// api/prs.ts - Personal Records handler (action-based routing)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, userClient, bearer, validateEnvForUser } from '../lib/api-helpers/supabase';
import { z } from 'zod';

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
    const action = req.body?.action || (req.method === 'GET' ? 'list' : 'create');

    // ACTION: list - Get all personal records
    if (action === 'list') {
      const { data, error } = await supa
        .from('prs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) return res.status(500).json({ message: 'Failed to fetch personal records' });
      return res.status(200).json(data || []);
    }

    // ACTION: create - Create new personal record
    if (action === 'create') {
      const prSchema = z.object({
        exercise: z.string().optional(),
        movement: z.string().optional(),
        category: z.string().optional(),
        weight: z.number(),
        unit: z.string().optional(),
        reps: z.number().optional(),
        repMax: z.number().optional(),
        date: z.string().optional()
      });

      const validatedData = prSchema.parse(req.body);
      
      const { data, error } = await supa
        .from('prs')
        .insert({
          user_id: userId,
          movement: validatedData.exercise || validatedData.movement || 'Unknown',
          category: validatedData.category || 'General',
          weight_kg: validatedData.unit === 'LBS' ? validatedData.weight / 2.20462 : validatedData.weight,
          rep_max: (validatedData.reps || validatedData.repMax || 1) as 1 | 3 | 5 | 10,
          date: validatedData.date || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create PR:', error);
        return res.status(500).json({ message: 'Failed to create personal record' });
      }

      return res.status(200).json(data);
    }

    // ACTION: update - Update personal record
    if (action === 'update') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ message: 'PR ID required' });

      const updateSchema = z.object({
        weight: z.number().optional(),
        unit: z.string().optional(),
        reps: z.number().optional(),
        date: z.string().optional()
      });

      const validatedData = updateSchema.parse(updates);
      const dbUpdates: any = {};

      if (validatedData.weight !== undefined) {
        dbUpdates.weight_kg = validatedData.unit === 'LBS' ? validatedData.weight / 2.20462 : validatedData.weight;
      }
      if (validatedData.reps !== undefined) {
        dbUpdates.rep_max = validatedData.reps;
      }
      if (validatedData.date) {
        dbUpdates.date = validatedData.date;
      }

      const { data, error } = await supa
        .from('prs')
        .update(dbUpdates)
        .eq('user_id', userId)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update PR:', error);
        return res.status(500).json({ message: 'Failed to update personal record' });
      }

      return res.status(200).json(data);
    }

    // ACTION: delete - Delete personal record
    if (action === 'delete') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ message: 'PR ID required' });

      const { error } = await supa
        .from('prs')
        .delete()
        .eq('user_id', userId)
        .eq('id', id);

      if (error) {
        console.error('Failed to delete PR:', error);
        return res.status(404).json({ message: 'Personal record not found' });
      }

      return res.status(200).json({ message: 'Personal record deleted successfully' });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (error: any) {
    console.error('PRs error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid PR data', errors: error.issues });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
