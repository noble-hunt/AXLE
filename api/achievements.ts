// api/achievements.ts - Achievements handler
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

    // GET /api/achievements - List all achievements
    if (req.method === 'GET') {
      const { data, error } = await supa
        .from('achievements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch achievements:', error);
        return res.status(500).json({ message: 'Failed to fetch achievements' });
      }

      return res.status(200).json(data || []);
    }

    // PUT /api/achievements/batch - Batch update achievements
    if (req.url?.includes('/batch') && req.method === 'PUT') {
      const achievementBatchSchema = z.object({
        achievements: z.array(z.object({
          id: z.string(),
          description: z.string().optional(),
          progress: z.number().min(0).max(100),
          completed: z.boolean().optional(),
          unlocked: z.boolean().optional()
        }))
      });

      const validatedData = achievementBatchSchema.parse(req.body);

      const results = await Promise.all(
        validatedData.achievements.map(async (achievement) => {
          const { data, error } = await supa
            .from('achievements')
            .upsert({
              user_id: userId,
              name: achievement.id,
              description: achievement.description || '',
              progress: achievement.progress,
              unlocked: achievement.completed || achievement.unlocked || false
            })
            .select()
            .single();

          if (error) {
            console.error(`Failed to upsert achievement ${achievement.id}:`, error);
            return null;
          }

          return data;
        })
      );

      return res.status(200).json(results.filter(r => r !== null));
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Achievements error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid achievements data', errors: error.issues });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
