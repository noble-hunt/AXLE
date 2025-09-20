import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";

interface GroupPresence {
  userId: string;
  displayName: string;
  typing: boolean;
  online_at: string;
}

interface GroupRealtimeData {
  onlineMembers: GroupPresence[];
  isTyping: boolean;
  setTyping: (typing: boolean) => void;
  typingMembers: GroupPresence[];
}

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
  schema: string;
  table: string;
}

export function useGroupRealtime(
  groupId: string | null,
  onNewPost?: (post: any) => void,
  onNewReaction?: (reaction: any) => void,
  onReactionRemoved?: (reaction: any) => void,
  onRsvpChanged?: (rsvp: any) => void,
  onRsvpRemoved?: (rsvp: any) => void
): GroupRealtimeData {
  const { user } = useAppStore();
  const [onlineMembers, setOnlineMembers] = useState<GroupPresence[]>([]);
  const [isTyping, setIsTypingState] = useState(false);
  const [typingMembers, setTypingMembers] = useState<GroupPresence[]>([]);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get display name from user
  const displayName = user?.user_metadata?.full_name || 
                     user?.user_metadata?.name || 
                     user?.email?.split('@')[0] || 
                     'Anonymous';

  const setTyping = useCallback((typing: boolean) => {
    if (!channelRef.current || !user) return;

    setIsTypingState(typing);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update presence
    channelRef.current.track({
      userId: user.id,
      displayName,
      typing,
      online_at: new Date().toISOString(),
    });

    // Auto-clear typing after 3 seconds
    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTypingState(false);
        channelRef.current?.track({
          userId: user.id,
          displayName,
          typing: false,
          online_at: new Date().toISOString(),
        });
      }, 3000);
    }
  }, [user, displayName]);

  useEffect(() => {
    if (!groupId || !user) {
      return;
    }

    console.log(`🔴 [Realtime] Subscribing to group ${groupId}`);

    // Create channel for this specific group
    const channel = supabase
      .channel(`group:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_posts',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePayload) => {
          console.log('🆕 [Realtime] New group post:', payload.new);
          if (onNewPost) {
            onNewPost(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_reactions',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePayload) => {
          console.log('👍 [Realtime] New reaction:', payload.new);
          if (onNewReaction) {
            onNewReaction(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_reactions',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePayload) => {
          console.log('👎 [Realtime] Reaction removed:', payload.old);
          if (onReactionRemoved) {
            onReactionRemoved(payload.old);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_event_rsvps',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePayload) => {
          console.log('📅 [Realtime] New RSVP:', payload.new);
          if (onRsvpChanged) {
            onRsvpChanged(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_event_rsvps',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePayload) => {
          console.log('📅 [Realtime] RSVP updated:', payload.new);
          if (onRsvpChanged) {
            onRsvpChanged(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_event_rsvps',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: RealtimePayload) => {
          console.log('📅 [Realtime] RSVP removed:', payload.old);
          if (onRsvpRemoved) {
            onRsvpRemoved(payload.old);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as RealtimePresenceState<GroupPresence>;
        const members: GroupPresence[] = [];
        const typing: GroupPresence[] = [];

        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            members.push(presence);
            if (presence.typing) {
              typing.push(presence);
            }
          });
        });

        console.log(`👥 [Realtime] Members in group: ${members.length}`);
        setOnlineMembers(members);
        setTypingMembers(typing.filter(m => m.userId !== user.id)); // Exclude self
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 [Realtime] Member joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 [Realtime] Member left:', key, leftPresences);
      });

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ [Realtime] Subscribed to group channel');
        // Track initial presence
        await channel.track({
          userId: user.id,
          displayName,
          typing: false,
          online_at: new Date().toISOString(),
        });
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ [Realtime] Channel subscription error');
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ [Realtime] Channel subscription timed out');
      }
    });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log(`🔴 [Realtime] Unsubscribing from group ${groupId}`);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (channelRef.current) {
        channelRef.current.untrack();
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      
      setOnlineMembers([]);
      setTypingMembers([]);
      setIsTypingState(false);
    };
  }, [groupId, user, displayName, onNewPost, onNewReaction, onReactionRemoved, onRsvpChanged, onRsvpRemoved]);

  return {
    onlineMembers,
    isTyping,
    setTyping,
    typingMembers,
  };
}