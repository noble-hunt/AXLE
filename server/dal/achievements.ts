import { supabaseAdmin } from "../lib/supabaseAdmin";

export interface AchievementItem {
  name: string;
  description: string;
  progress: number;
  unlocked: boolean;
}

export async function upsertMany(userId: string, items: AchievementItem[]) {
  const insertData = items.map(item => ({
    user_id: userId,
    name: item.name,
    description: item.description,
    progress: item.progress,
    unlocked: item.unlocked,
    updated_at: new Date().toISOString()
  }));

  const { data, error } = await supabaseAdmin
    .from('achievements')
    .upsert(insertData, {
      onConflict: 'user_id,name',
      ignoreDuplicates: false
    })
    .select();

  if (error) {
    throw new Error(`Failed to upsert achievements: ${error.message}`);
  }

  return data || [];
}

export async function list(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('achievements')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list achievements: ${error.message}`);
  }

  return data || [];
}