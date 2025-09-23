// client/src/features/groups/hooks/useGroupPostsLive.ts
import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type OnInsert = (row: any) => void;

export function useGroupPostsLive(groupId: string | undefined, onInsert: OnInsert) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastSeenRef = useRef<string | null>(null); // ISO timestamp cursor

  useEffect(() => {
    if (!groupId) return;

    // --- try Realtime first
    let subscribed = false;
    const channel = supabase
      .channel(`grp:${groupId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_posts', filter: `group_id=eq.${groupId}` },
        (payload) => {
          subscribed = true;
          const row = payload.new as any;
          lastSeenRef.current = row.created_at;
          onInsert(row);
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') subscribed = true;
      });
    channelRef.current = channel;

    // --- after 1500ms, if not subscribed, fall back to polling
    const t = window.setTimeout(() => {
      if (subscribed) return;
      // stop channel if it didn't subscribe cleanly
      supabase.removeChannel(channel);
      channelRef.current = null;

      // start polling
      const tick = async () => {
        try {
          const params = lastSeenRef.current ? `?since=${encodeURIComponent(lastSeenRef.current)}` : '';
          const res = await fetch(`/api/groups/${groupId}/posts${params}`);
          if (!res.ok) return;
          const { posts } = await res.json();
          if (Array.isArray(posts) && posts.length) {
            posts.slice().reverse().forEach((p: any) => onInsert(p));
            lastSeenRef.current = posts[0].created_at ?? lastSeenRef.current;
          }
        } catch {}
      };
      tick(); // initial
      pollRef.current = window.setInterval(tick, 3000) as unknown as number;
    }, 1500);

    return () => {
      window.clearTimeout(t);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [groupId, onInsert]);
}