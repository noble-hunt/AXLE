// api/prs.ts - Personal Records handler
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

    // GET /api/prs - List all personal records
    if (req.method === 'GET') {
      const { data, error } = await supa
        .from('prs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) return res.status(500).json({ message: 'Failed to fetch personal records' });
      return res.status(200).json(data || []);
    }

    // POST /api/prs - Create new personal record
    if (req.method === 'POST') {
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

    // PUT /api/prs/:id - Update personal record
    if (req.method === 'PUT') {
      const id = req.url?.split('/').pop();
      if (!id) return res.status(400).json({ message: 'PR ID required' });

      const updateSchema = z.object({
        weight: z.number().optional(),
        unit: z.string().optional(),
        reps: z.number().optional(),
        date: z.string().optional()
      });

      const validatedData = updateSchema.parse(req.body);
      const updates: any = {};

      if (validatedData.weight !== undefined) {
        updates.weight_kg = validatedData.unit === 'LBS' ? validatedData.weight / 2.20462 : validatedData.weight;
      }
      if (validatedData.reps !== undefined) {
        updates.rep_max = validatedData.reps;
      }
      if (validatedData.date) {
        updates.date = validatedData.date;
      }

      const { data, error } = await supa
        .from('prs')
        .update(updates)
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

    // DELETE /api/prs/:id - Delete personal record
    if (req.method === 'DELETE') {
      const id = req.url?.split('/').pop();
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

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('PRs error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid PR data', errors: error.issues });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
