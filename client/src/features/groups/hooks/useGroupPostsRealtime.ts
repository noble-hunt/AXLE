// client/src/features/groups/hooks/useGroupPostsRealtime.ts
import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
type OnInsert = (row: any) => void;

export function useGroupPostsRealtime(groupId: string | undefined, onInsert: OnInsert) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!groupId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`grp:${groupId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_posts', filter: `group_id=eq.${groupId}` },
        (payload) => onInsertRef.current(payload.new))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.debug('[Realtime] subscribed', groupId);
      });
    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.debug('[Realtime] unsubscribed', groupId);
        channelRef.current = null;
      }
    };
  }, [groupId]);
}