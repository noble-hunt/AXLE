import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function JoinGroupPage() {
  const [, params] = useRoute('/g/:id');
  const [, setLocation] = useLocation();
  const id = params?.id;
  const [group, setGroup] = useState<any>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) { 
        setLocation(`/auth/login?redirect=${encodeURIComponent(`/g/${id}`)}`, { replace: true }); 
        return; 
      }
      const { data } = await supabase.from('groups').select('id,name,visibility,photo_url,description').eq('id', id).maybeSingle();
      setGroup(data);
    })();
  }, [id, setLocation]);

  const join = async () => {
    setJoining(true);
    const userId = (await supabase.auth.getUser()).data.user?.id!;
    const { data: exists } = await supabase.from('group_members').select('user_id').eq('group_id', id).eq('user_id', userId).maybeSingle();
    if (!exists) {
      const { error } = await supabase.from('group_members').insert({ group_id: id!, user_id: userId, role: 'member' });
      if (error) { 
        setJoining(false); 
        alert(error.message); 
        return; 
      }
    }
    setLocation(`/groups/${id}`, { replace: true });
  };

  if (!group) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-md px-4 pb-24">
      <Card className="mt-6">
        <div className="flex items-center gap-4">
          {group.photo_url ? (
            <img src={group.photo_url} className="h-12 w-12 rounded-xl object-cover" alt="" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-muted" />
          )}
          <div>
            <div className="text-lg font-semibold">{group.name}</div>
            <div className="text-sm text-muted-foreground">
              {group.visibility === 'public' ? 'Public' : 'Private'} group
            </div>
          </div>
        </div>
        {group.description && (
          <p className="mt-4 text-muted-foreground">{group.description}</p>
        )}
        <Button className="w-full mt-6" disabled={joining} onClick={join}>
          {joining ? 'Joining…' : 'Join Group'}
        </Button>
      </Card>
    </div>
  );
}