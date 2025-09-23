import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Send, 
  Share, 
  Trophy, 
  Users, 
  Lock, 
  Globe,
  Dumbbell,
  Calendar,
  Check,
  Bell,
  ExternalLink,
  MoreHorizontal,
  LogOut,
  Trash
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import { useAppStore } from "@/store/useAppStore";
import { formatDistanceToNow, isValid } from "date-fns";
import { EventRsvpButtons } from "@/components/groups/EventRsvpButtons";
import { EventReminderBanner } from "@/components/groups/EventReminderBanner";
import { FeedNudgeCard } from "@/components/groups/FeedNudgeCard";
import { GroupWorkoutEventCard } from "@/components/groups/GroupWorkoutEventCard";
import { BackButton } from "@/components/ui/back-button";
import { useGroupAchievements } from "@/hooks/useGroupAchievements";
import { queryClient } from "@/lib/queryClient";
import { useReactionRateLimit, useComposerRateLimit } from "@/hooks/useRateLimit";
import { nanoid } from "nanoid";

// Emoji picker emojis
const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '🙌'];

// Safe date formatting helper
const formatWorkoutDate = (createdAt: string | Date | null | undefined): string => {
  if (!createdAt) return 'Recently';
  
  try {
    const date = new Date(createdAt);
    if (!isValid(date)) return 'Recently';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Recently';
  }
};

interface Group {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  isPublic: boolean;
  memberCount?: number;
  userRole?: string;
}

interface Post {
  id: string;
  kind: "text" | "workout" | "pr" | "event";
  content: Record<string, any>;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
}

interface Reaction {
  emoji: string;
  count: number;
  users: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  userReacted: boolean;
}

interface PostReactions {
  [postId: string]: Reaction[];
}

interface Workout {
  id: string;
  name: string;
  category: string;
  duration: number;
  createdAt: string;
  intensity: number;
}

interface PRFormData {
  movement: string;
  reps: number;
  weight: number;
  unit: "kg" | "lbs";
}

const POSTS_PER_PAGE = 20;

export default function GroupFeedPage() {
  const [, params] = useRoute("/groups/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAppStore();
  
  // Rate limiting hooks
  const reactionRateLimit = useReactionRateLimit();
  const composerRateLimit = useComposerRateLimit();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Composer state
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  
  // Workout sharing
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  
  // PR sharing
  const [showPRModal, setShowPRModal] = useState(false);
  const [prForm, setPRForm] = useState<PRFormData>({
    movement: "",
    reps: 1,
    weight: 0,
    unit: "kg"
  });
  
  // Cross-posting
  const [crossPost, setCrossPost] = useState(false);
  const [showGroupSelect, setShowGroupSelect] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  
  // Reactions state
  const [postReactions, setPostReactions] = useState<PostReactions>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });

  // Group management state
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Group editing state
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupDescription, setEditingGroupDescription] = useState("");
  const [editingGroupPhoto, setEditingGroupPhoto] = useState("");
  const [savingGroupChanges, setSavingGroupChanges] = useState(false);
  
  // Member management state
  const [showMembers, setShowMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const groupId = params?.id;
  const parentRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Real-time updates
  const { onlineMembers, isTyping, setTyping, typingMembers } = useGroupRealtime(
    groupId || null, 
    // onNewPost callback
    (newPost) => {
      console.log('New post received via real-time:', newPost);
      // De-duplicate by ID
      setPosts(prev => {
        if (prev.some(p => p.id === newPost.id)) return prev;
        return [...prev, newPost];
      });
      // Auto-scroll to bottom for new messages
      if (autoScroll) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    },
    // onNewReaction callback  
    (reaction) => {
      console.log('New reaction received:', reaction);
      // Refresh reactions for the post
      if (reaction.postId) {
        loadReactionsForPost(reaction.postId);
      }
    },
    // onReactionRemoved callback
    (reaction) => {
      console.log('Reaction removed:', reaction);
      // Refresh reactions for the post
      if (reaction.postId) {
        loadReactionsForPost(reaction.postId);
      }
    },
    // onRsvpChanged callback
    (rsvp) => {
      console.log('RSVP changed:', rsvp);
      // Invalidate RSVP queries for the specific post (use snake_case from DB)
      const postId = rsvp.postId ?? rsvp.post_id;
      if (postId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/groups', groupId, 'posts', postId, 'rsvps'] 
        });
      }
    },
    // onRsvpRemoved callback
    (rsvp) => {
      console.log('RSVP removed:', rsvp);
      // Invalidate RSVP queries for the specific post (use snake_case from DB)
      const postId = rsvp.postId ?? rsvp.post_id;
      if (postId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/groups', groupId, 'posts', postId, 'rsvps'] 
        });
      }
    },
    // onNewMessage callback
    (newMessage) => {
      console.log('💬 New message received via real-time:', newMessage);
      
      // Extract author info from profiles join
      const profile = newMessage.profiles;
      const authorName = profile 
        ? (profile.first_name && profile.last_name 
            ? `${profile.first_name} ${profile.last_name}` 
            : profile.username || 'Anonymous')
        : 'Unknown';
      
      // Transform message to match Post interface format
      const transformedMessage = {
        id: newMessage.id,
        kind: 'message' as const,
        content: { body: newMessage.body, message: newMessage.body },
        createdAt: newMessage.created_at,
        authorId: newMessage.author_id,
        authorName: authorName,
        authorAvatar: profile?.avatar_url
      };
      
      // De-duplicate by ID and add to posts
      setPosts(prev => {
        if (prev.some(p => p.id === transformedMessage.id)) return prev;
        return [...prev, transformedMessage];
      });
      
      // Auto-scroll to bottom for new messages
      if (autoScroll) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  );

  // Auto-scroll to bottom when new posts are added
  useEffect(() => {
    if (autoScroll && posts.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [posts.length, autoScroll]);

  // Load reactions for all posts when posts change
  useEffect(() => {
    if (posts.length > 0 && groupId) {
      posts.forEach(post => {
        if (!postReactions[post.id]) {
          loadReactionsForPost(post.id);
        }
      });
    }
  }, [posts, groupId]);

  // Group achievements hook for confetti celebrations
  const { achievements, checkForNewUnlocks } = useGroupAchievements();

  // Fetch group achievements and check for new unlocks
  useEffect(() => {
    if (!groupId) return;
    
    const fetchAchievements = async () => {
      try {
        const response = await authFetch(`/api/groups/${groupId}/achievements`);
        if (response.ok) {
          const data = await response.json();
          checkForNewUnlocks(data);
        }
      } catch (error) {
        console.error("Failed to fetch group achievements:", error);
      }
    };

    fetchAchievements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]); // Only run when groupId changes, not when checkForNewUnlocks identity changes

  // Virtual list for ascending order (newest at bottom)
  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimate post height
    overscan: 5,
  });

  useEffect(() => {
    if (!groupId) return;
    loadGroup();
    loadPosts();
  }, [groupId]);

  const loadGroup = async () => {
    try {
      const response = await authFetch(`/api/groups/${groupId}`);
      if (response.ok) {
        const groupData = await response.json();
        setGroup(groupData);
      } else if (response.status === 404) {
        toast({
          title: "Group not found",
          description: "This group doesn't exist or you don't have access to it",
          variant: "destructive",
        });
        setLocation("/groups");
      }
    } catch (error) {
      console.error("Failed to load group:", error);
      toast({
        title: "Failed to load group",
        description: "Unable to fetch group details",
        variant: "destructive",
      });
    }
  };

  const loadPosts = async (before?: string) => {
    try {
      if (!before) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Load both posts and messages in parallel
      const postsUrl = new URL(`/api/groups/${groupId}/feed`, window.location.origin);
      if (before) postsUrl.searchParams.set('before', before);
      postsUrl.searchParams.set('limit', Math.floor(POSTS_PER_PAGE / 2).toString());

      const messagesUrl = new URL(`/api/groups/${groupId}/messages`, window.location.origin);
      if (before) messagesUrl.searchParams.set('before', before);
      messagesUrl.searchParams.set('limit', Math.floor(POSTS_PER_PAGE / 2).toString());

      const [postsResponse, messagesResponse] = await Promise.all([
        // Load posts (events, workouts, PRs)
        authFetch(postsUrl.toString()),
        // Load messages (direct messages)
        authFetch(messagesUrl.toString())
      ]);

      if (postsResponse.ok && messagesResponse.ok) {
        const [newPosts, newMessages] = await Promise.all([
          postsResponse.json(),
          messagesResponse.json()
        ]);
        
        // Transform messages to match Post interface
        const transformedMessages = newMessages.map((msg: any) => {
          // Extract author info from profiles join
          const profile = msg.profiles;
          const authorName = profile 
            ? (profile.first_name && profile.last_name 
                ? `${profile.first_name} ${profile.last_name}` 
                : profile.username || 'Anonymous')
            : 'Unknown';
          
          return {
            id: msg.id,
            kind: 'message' as const,
            content: { body: msg.body, message: msg.body },
            createdAt: msg.created_at,
            authorId: msg.author_id,
            authorName: authorName,
            authorAvatar: profile?.avatar_url
          };
        });
        
        // Merge and sort by creation time (oldest first, newest last)
        const combined = [...newPosts, ...transformedMessages].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        if (before) {
          // Prepend older posts (for infinite up scroll)
          setPosts(prev => [...combined, ...prev]);
        } else {
          // Initial load
          setPosts(combined);
        }
        
        setHasMore(combined.length === POSTS_PER_PAGE);
      } else {
        throw new Error("Failed to load feed data");
      }
    } catch (error) {
      console.error("Failed to load posts:", error);
      toast({
        title: "Failed to load posts",
        description: "Unable to fetch group feed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMorePosts = () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    
    const oldestPost = posts[0]; // First post is oldest in ascending order
    loadPosts(oldestPost.createdAt);
  };

  // Determine if nudge should be shown
  const shouldShowNudge = (): boolean => {
    // Don't show if loading or typing members present (active)
    if (loading || typingMembers.length > 0) return false;
    
    // Show if no posts at all
    if (posts.length === 0) return true;
    
    // Check if most recent post is older than 24 hours
    const mostRecentPost = posts[posts.length - 1]; // Newest post is at end
    if (mostRecentPost) {
      const lastPostTime = new Date(mostRecentPost.createdAt);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Show nudge if most recent post is older than 24 hours and we have less than 10 posts total
      return lastPostTime < twentyFourHoursAgo && posts.length < 10;
    }
    
    return false;
  };

  // Group editing functions
  const startEditingGroup = () => {
    if (group) {
      setEditingGroupName(group.name);
      setEditingGroupDescription(group.description || "");
      setEditingGroupPhoto(group.photoUrl || "");
      setIsEditingGroup(true);
    }
  };

  const cancelEditingGroup = () => {
    setIsEditingGroup(false);
    setEditingGroupName("");
    setEditingGroupDescription("");
    setEditingGroupPhoto("");
  };

  const saveGroupChanges = async () => {
    if (!group || savingGroupChanges) return;
    
    try {
      setSavingGroupChanges(true);
      
      const response = await authFetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingGroupName,
          description: editingGroupDescription,
          photoUrl: editingGroupPhoto || null
        })
      });

      if (response.ok) {
        const updatedGroup = await response.json();
        setGroup(updatedGroup);
        setIsEditingGroup(false);
        // Invalidate related cache
        queryClient.invalidateQueries({ queryKey: ['/api/groups', group.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
        toast({
          title: "Group updated",
          description: "Your group details have been saved"
        });
      } else {
        throw new Error('Failed to update group');
      }
    } catch (error) {
      console.error("Failed to update group:", error);
      toast({
        title: "Failed to update group",
        description: "Unable to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingGroupChanges(false);
    }
  };

  const loadGroupMembers = async () => {
    if (!group || loadingMembers) return;
    
    try {
      setLoadingMembers(true);
      const response = await authFetch(`/api/groups/${group.id}/members`);
      
      if (response.ok) {
        const members = await response.json();
        setGroupMembers(members);
        setShowMembers(true);
      } else {
        throw new Error('Failed to load members');
      }
    } catch (error) {
      console.error("Failed to load group members:", error);
      toast({
        title: "Failed to load members",
        description: "Unable to fetch group members",
        variant: "destructive",
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const addMemberToGroup = async () => {
    if (!group || !newMemberUserId || addingMember || group.userRole !== 'owner') return;
    
    try {
      setAddingMember(true);
      const response = await authFetch(`/api/groups/${group.id}/members/admin-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newMemberUserId,
          role: 'member'
        })
      });

      if (response.ok) {
        setNewMemberUserId("");
        // Refresh members list
        loadGroupMembers();
        toast({
          title: "Member added",
          description: "New member has been added to the group"
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add member');
      }
    } catch (error) {
      console.error("Failed to add member:", error);
      toast({
        title: "Failed to add member",
        description: error instanceof Error ? error.message : "Unable to add member",
        variant: "destructive",
      });
    } finally {
      setAddingMember(false);
    }
  };

  const removeMemberFromGroup = async (userId: string) => {
    if (!group || !userId || group.userRole !== 'owner') return;
    
    try {
      const response = await authFetch(`/api/groups/${group.id}/members/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh members list
        loadGroupMembers();
        toast({
          title: "Member removed",
          description: "Member has been removed from the group"
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast({
        title: "Failed to remove member",
        description: error instanceof Error ? error.message : "Unable to remove member",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || posting || !groupId || !user) return;

    // For cross-posting, use the old posts system
    if (crossPost && selectedGroups.length > 0) {
      const targetGroups = selectedGroups;
      
      await composerRateLimit.execute(async () => {
        setPosting(true);
        try {
          const response = await authFetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "text",
              content: { message: message.trim() },
              groupIds: targetGroups,
            }),
          });

          if (response.ok) {
            setMessage("");
            setCrossPost(false);
            setSelectedGroups([]);
            
            toast({
              title: "Message sent!",
              description: `Posted to ${targetGroups.length} groups`,
            });
          } else {
            throw new Error("Failed to send message");
          }
        } catch (error) {
          console.error("Failed to send message:", error);
          toast({
            title: "Failed to send message",
            description: "Please try again",
            variant: "destructive",
          });
        } finally {
          setPosting(false);
        }
      });
      return;
    }

    // For single group messaging, use optimistic UI with new messaging system
    await composerRateLimit.execute(async () => {
      const messageId = nanoid(); // Generate proper UUID for optimistic message
      const optimisticMessage = {
        id: messageId,
        body: message.trim(),
        authorId: user.id,
        authorName: user.name || user.email || 'You',
        authorAvatar: user.avatar,
        createdAt: new Date().toISOString(),
        groupId: groupId,
        kind: 'message' as const,
        optimistic: true
      };

      // Add optimistic message immediately
      setPosts(prev => [...prev, optimisticMessage as any]);
      const originalMessage = message.trim();
      setMessage("");
      setPosting(true);

      // Auto-scroll to bottom for new messages
      if (autoScroll) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }

      try {
        const response = await authFetch(`/api/groups/${groupId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: messageId, // Pass client-generated ID for optimistic UI reconciliation
            body: originalMessage
          }),
        });

        if (response.ok) {
          const serverMessage = await response.json();
          
          // Replace optimistic message with server response
          // Since we sent the client ID, the server should return the same ID
          setPosts(prev => prev.map(p => 
            p.id === messageId 
              ? { 
                  ...serverMessage, 
                  kind: 'message', 
                  authorName: user.name || user.email || 'You', 
                  authorAvatar: user.avatar,
                  optimistic: false // Mark as no longer optimistic
                }
              : p
          ));
        } else {
          throw new Error("Failed to send message");
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        
        // Remove optimistic message on error
        setPosts(prev => prev.filter(p => p.id !== optimisticMessage.id));
        
        // Restore message text for retry
        setMessage(originalMessage);
        
        toast({
          title: "Failed to send message",
          description: "Please try again",
          variant: "destructive",
        });
      } finally {
        setPosting(false);
      }
    });
  };

  const handleShareWorkout = async (workout: Workout) => {
    const targetGroups = crossPost && selectedGroups.length > 0 ? selectedGroups : [groupId!];
    
    try {
      const response = await authFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "workout",
          content: {
            workoutId: workout.id,
            name: workout.name,
            category: workout.category,
            duration: workout.duration,
            intensity: workout.intensity,
          },
          groupIds: targetGroups,
        }),
      });

      if (response.ok) {
        // Don't add locally - let real-time handle it to avoid duplication
        setShowWorkoutModal(false);
        setCrossPost(false);
        setSelectedGroups([]);
        
        toast({
          title: "Workout shared!",
          description: crossPost ? `Shared to ${targetGroups.length} groups` : "Shared to group",
        });
      }
    } catch (error) {
      console.error("Failed to share workout:", error);
      toast({
        title: "Failed to share workout",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleSharePR = async () => {
    if (!prForm.movement || !prForm.weight || prForm.weight <= 0) return;

    const targetGroups = crossPost && selectedGroups.length > 0 ? selectedGroups : [groupId!];
    
    try {
      const response = await authFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "pr",
          content: {
            movement: prForm.movement,
            reps: prForm.reps,
            weight: prForm.weight,
            unit: prForm.unit,
          },
          groupIds: targetGroups,
        }),
      });

      if (response.ok) {
        // Don't add locally - let real-time handle it to avoid duplication
        setShowPRModal(false);
        setPRForm({ movement: "", reps: 1, weight: 0, unit: "kg" });
        setCrossPost(false);
        setSelectedGroups([]);
        
        toast({
          title: "PR shared!",
          description: crossPost ? `Shared to ${targetGroups.length} groups` : "Shared to group",
        });
      }
    } catch (error) {
      console.error("Failed to share PR:", error);
      toast({
        title: "Failed to share PR",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Load reactions for a specific post
  const loadReactionsForPost = async (postId: string) => {
    if (!groupId) return;
    
    try {
      const response = await authFetch(`/api/groups/${groupId}/reactions?post_id=${postId}`);
      if (response.ok) {
        const reactions = await response.json();
        setPostReactions(prev => ({
          ...prev,
          [postId]: reactions
        }));
      }
    } catch (error) {
      console.error("Failed to load reactions:", error);
    }
  };

  // Toggle reaction with optimistic UI
  const toggleReaction = async (postId: string, emoji: string) => {
    if (!groupId || !user) return;

    await reactionRateLimit.execute(async () => {
      // Optimistic update
      const currentReactions = postReactions[postId] || [];
      const existingReaction = currentReactions.find(r => r.emoji === emoji);
      
      let optimisticReactions: Reaction[];
      if (existingReaction?.userReacted) {
        // Remove reaction - only update count and userReacted flag, let server handle users
        optimisticReactions = currentReactions.map(r => 
          r.emoji === emoji 
            ? { ...r, count: r.count - 1, userReacted: false }
            : r
        ).filter(r => r.count > 0);
      } else {
        // Add reaction - only update count and userReacted flag, let server handle users
        if (existingReaction) {
          optimisticReactions = currentReactions.map(r => 
            r.emoji === emoji 
              ? { ...r, count: r.count + 1, userReacted: true }
              : r
          );
        } else {
          optimisticReactions = [...currentReactions, { 
            emoji, 
            count: 1, 
            userReacted: true, 
            users: [] // Let server populate users to avoid ID mismatches
          }];
        }
      }

      setPostReactions(prev => ({
        ...prev,
        [postId]: optimisticReactions
      }));

      try {
        const response = await authFetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId,
            postId,
            emoji,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to toggle reaction");
        }

        // Refresh reactions to get accurate data
        loadReactionsForPost(postId);
      } catch (error) {
        console.error("Failed to toggle reaction:", error);
        // Rollback optimistic update
        loadReactionsForPost(postId);
        
        toast({
          title: "Failed to react",
          description: "Please try again",
          variant: "destructive",
        });
      }
    });
  };

  // Handle long-press or right-click
  const handlePostInteraction = (e: React.MouseEvent | React.TouchEvent, postId: string) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    setEmojiPickerPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 60
    });
    setShowEmojiPicker(postId);
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !user || leavingGroup) return;

    setLeavingGroup(true);
    try {
      const response = await authFetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Invalidate group queries - align with actual query keys used in the app
        queryClient.invalidateQueries({ queryKey: ['/api/groups/mine'] });
        queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId] });
        queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId, 'feed'] });
        
        toast({
          title: "Left group",
          description: "You have left the group successfully",
        });
        // Redirect to groups page
        setLocation('/groups');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to leave group');
      }
    } catch (error) {
      console.error('Failed to leave group:', error);
      toast({
        title: "Failed to leave group",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLeavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || !user || deletingGroup) return;

    setDeletingGroup(true);
    try {
      const response = await authFetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Invalidate group queries - align with actual query keys used in the app
        queryClient.invalidateQueries({ queryKey: ['/api/groups/mine'] });
        queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId] });
        queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId, 'feed'] });
        
        toast({
          title: "Group deleted",
          description: "The group has been deleted successfully",
        });
        // Redirect to groups page
        setLocation('/groups');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast({
        title: "Failed to delete group",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDeletingGroup(false);
    }
  };

  const loadRecentWorkouts = async () => {
    setLoadingWorkouts(true);
    try {
      const response = await authFetch("/api/workouts?limit=10");
      if (response.ok) {
        const workouts = await response.json();
        setRecentWorkouts(workouts);
      }
    } catch (error) {
      console.error("Failed to load workouts:", error);
    } finally {
      setLoadingWorkouts(false);
    }
  };

  const loadAvailableGroups = async () => {
    try {
      const response = await authFetch("/api/groups/mine");
      if (response.ok) {
        const groups = await response.json();
        setAvailableGroups(groups.filter((g: Group) => g.id !== groupId));
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const getInitials = (name: string | undefined | null) => {
    if (!name || typeof name !== 'string') return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const renderPost = (post: Post) => {
    const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
    const reactions = postReactions[post.id] || [];
    
    return (
      <Card key={post.id} className="rounded-2xl bg-zinc-900/70 border border-white/10 p-4 md:p-5 space-y-3" data-testid={`post-${post.id}`}>
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={post.authorAvatar} alt={post.authorName} />
            <AvatarFallback className="text-sm">
              {getInitials(post.authorName)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg md:text-xl font-semibold text-white/90">{post.authorName}</span>
              <span className="text-sm text-white/70">{timeAgo}</span>
            </div>
          
            {post.kind === "text" && (
              <div 
                className="bg-white/5 rounded-xl px-4 py-3 cursor-pointer break-words"
                onContextMenu={(e) => handlePostInteraction(e, post.id)}
                onTouchStart={(e) => {
                  // Long-press detection
                  const timeout = setTimeout(() => handlePostInteraction(e, post.id), 500);
                  e.currentTarget.dataset.pressTimer = timeout.toString();
                }}
                onTouchEnd={(e) => {
                  const timer = e.currentTarget.dataset.pressTimer;
                  if (timer) {
                    clearTimeout(parseInt(timer));
                    delete e.currentTarget.dataset.pressTimer;
                  }
                }}
              >
                <p className="text-white/90 leading-relaxed">{post.content.message}</p>
              </div>
            )}
          
            {post.kind === "workout" && (
              <div 
                className="bg-white/5 rounded-xl p-4 cursor-pointer break-words"
                onContextMenu={(e) => handlePostInteraction(e, post.id)}
                onTouchStart={(e) => {
                  const timeout = setTimeout(() => handlePostInteraction(e, post.id), 500);
                  e.currentTarget.dataset.pressTimer = timeout.toString();
                }}
                onTouchEnd={(e) => {
                  const timer = e.currentTarget.dataset.pressTimer;
                  if (timer) {
                    clearTimeout(parseInt(timer));
                    delete e.currentTarget.dataset.pressTimer;
                  }
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-white/90">{post.content.name}</span>
                </div>
                <div className="text-sm text-white/70 mb-3">
                  {post.content.category} • {post.content.duration}min • Intensity {post.content.intensity}/10
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-2 leading-none" aria-label="View workout details">
                  <ExternalLink className="w-4 h-4" />
                  View workout
                </Button>
              </div>
            )}
          
            {post.kind === "pr" && (
              <div 
                className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl px-4 py-3 cursor-pointer break-words"
                onContextMenu={(e) => handlePostInteraction(e, post.id)}
                onTouchStart={(e) => {
                  const timeout = setTimeout(() => handlePostInteraction(e, post.id), 500);
                  e.currentTarget.dataset.pressTimer = timeout.toString();
                }}
                onTouchEnd={(e) => {
                  const timer = e.currentTarget.dataset.pressTimer;
                  if (timer) {
                    clearTimeout(parseInt(timer));
                    delete e.currentTarget.dataset.pressTimer;
                  }
                }}
              >
                <div className="flex items-center gap-2 text-white/90">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold">New PR:</span>
                  <span>{post.content.reps}RM {post.content.movement} {post.content.weight}{post.content.unit}</span>
                  <span>🎉</span>
                </div>
              </div>
            )}
          
          {post.kind === "event" && (
            // Use enhanced component for group workout events, standard component for regular events
            post.content.workoutData ? (
              <GroupWorkoutEventCard
                post={post as any}
                groupId={groupId!}
                onContextMenu={handlePostInteraction}
                onTouchStart={(e) => {
                  const target = e.currentTarget as HTMLElement;
                  const timeout = setTimeout(() => handlePostInteraction(e, post.id), 500);
                  target.dataset.pressTimer = timeout.toString();
                }}
                onTouchEnd={(e) => {
                  const target = e.currentTarget as HTMLElement;
                  const timer = target.dataset.pressTimer;
                  if (timer) {
                    clearTimeout(parseInt(timer));
                    delete target.dataset.pressTimer;
                  }
                }}
              />
            ) : (
              <div 
                className="bg-white/5 rounded-xl p-4 cursor-pointer break-words"
                onContextMenu={(e) => handlePostInteraction(e, post.id)}
                onTouchStart={(e) => {
                  const timeout = setTimeout(() => handlePostInteraction(e, post.id), 500);
                  e.currentTarget.dataset.pressTimer = timeout.toString();
                }}
                onTouchEnd={(e) => {
                  const timer = e.currentTarget.dataset.pressTimer;
                  if (timer) {
                    clearTimeout(parseInt(timer));
                    delete e.currentTarget.dataset.pressTimer;
                  }
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-white/90">{post.content.title}</span>
                </div>
                
                {/* Event Details */}
                <div className="text-sm text-white/70 mb-4 space-y-1">
                  <div>
                    📅 {new Date(post.content.start_at).toLocaleString()}
                  </div>
                  <div>
                    ⏰ {post.content.duration_min} minutes
                  </div>
                  {post.content.location && (
                    <div>
                      📍 {post.content.location}
                    </div>
                  )}
                </div>

                {/* RSVP Buttons */}
                <EventRsvpButtons postId={post.id} groupId={groupId!} />
              </div>
            )
          )}
          
          </div>
        </div>
        
        {/* Reactions */}
        <div className="flex flex-wrap items-center gap-2">
          {REACTION_EMOJIS.map((emoji) => {
            const reaction = reactions.find(r => r.emoji === emoji);
            const count = reaction?.count || 0;
            const userReacted = reaction?.userReacted || false;
            
            // Only show if there are reactions or user hasn't reacted yet
            if (count === 0 && !userReacted) {
              return (
                <button
                  key={emoji}
                  className="px-2 h-8 rounded-full bg-white/10 hover:bg-white/15 text-white/60 hover:text-white/90 text-sm transition-colors min-h-[36px]"
                  onClick={() => toggleReaction(post.id, emoji)}
                  data-testid={`reaction-${emoji}-${post.id}`}
                  aria-label={`React with ${emoji}`}
                >
                  <span>{emoji}</span>
                </button>
              );
            }
            
            return (
              <button
                key={emoji}
                className={`px-2 h-8 rounded-full text-sm transition-colors min-h-[36px] ${
                  userReacted 
                    ? 'bg-primary/20 text-white/90 border border-primary/30' 
                    : 'bg-white/10 hover:bg-white/15 text-white/90 border border-white/10'
                }`}
                onClick={() => toggleReaction(post.id, emoji)}
                data-testid={`reaction-${emoji}-${post.id}`}
                title={reaction && reaction.users ? reaction.users.slice(0, 3).map(u => u.name).join(', ') : ''}
                aria-label={`${userReacted ? 'Remove' : 'Add'} ${emoji} reaction (${count})`}
              >
                <span className="mr-1">{emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/groups")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Groups
          </Button>
          <div className="animate-pulse bg-muted rounded w-32 h-6"></div>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading group feed...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] max-h-[100dvh]">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-background/95 backdrop-blur-sm">
        {/* First line: Back button, Avatar, Group name and info */}
        <div className="flex items-center gap-3 mb-3">
          <BackButton fallbackPath="/groups" />
          
          <Avatar className="w-8 h-8">
            <AvatarImage src={group.photoUrl} alt={group.name} />
            <AvatarFallback className="text-xs">
              {getInitials(group.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg">{group.name}</h1>
              {group.isPublic ? (
                <Globe className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{group.memberCount || 0} members</span>
              {onlineMembers.length > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{onlineMembers.length} online</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Second line: Action buttons */}
        <div className="flex gap-2 ml-11">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/groups/${groupId}/invite`)}
            data-testid="invite-button"
          >
            <Users className="w-4 h-4 mr-2" />
            Invite
          </Button>
          
          {/* Group Management - owners only get edit button, others get leave option */}
          {group.userRole === 'owner' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingGroup(!isEditingGroup)}
              data-testid="edit-group-button"
            >
              {isEditingGroup ? "Cancel" : "Edit Group"}
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="group-menu-button">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setShowLeaveConfirm(true)}
                  disabled={leavingGroup}
                  data-testid="leave-group-button"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {leavingGroup ? "Leaving..." : "Leave Group"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Group Edit Interface - Only for owners when editing */}
      {isEditingGroup && group.userRole === 'owner' && (
        <div className="flex-shrink-0 p-4 border-b bg-muted/50">
          <Card className="p-4">
            <div className="space-y-4">
              {/* Group Details Section */}
              <div>
                <h3 className="font-medium mb-3">Group Details</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input
                      id="group-name"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      placeholder="Enter group name"
                      data-testid="edit-group-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="group-description">Description</Label>
                    <Textarea
                      id="group-description"
                      value={editingGroupDescription}
                      onChange={(e) => setEditingGroupDescription(e.target.value)}
                      placeholder="Describe your group..."
                      className="min-h-[60px]"
                      data-testid="edit-group-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="group-photo">Photo URL</Label>
                    <Input
                      id="group-photo"
                      value={editingGroupPhoto}
                      onChange={(e) => setEditingGroupPhoto(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      data-testid="edit-group-photo"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={saveGroupChanges}
                      disabled={savingGroupChanges || !editingGroupName.trim()}
                      data-testid="save-group-changes"
                    >
                      {savingGroupChanges ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEditingGroup}
                      disabled={savingGroupChanges}
                      data-testid="cancel-group-edit"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>

              {/* Member Management Section - Owner only */}
              {group.userRole === 'owner' && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Member Management</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadGroupMembers}
                      disabled={loadingMembers}
                      data-testid="load-members-button"
                    >
                      {showMembers ? "Refresh Members" : "View Members"}
                    </Button>
                  </div>
                  
                  {/* Add Member */}
                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="User ID to add"
                      value={newMemberUserId}
                      onChange={(e) => setNewMemberUserId(e.target.value)}
                      data-testid="add-member-input"
                    />
                    <Button
                      onClick={addMemberToGroup}
                      disabled={!newMemberUserId.trim() || addingMember}
                      data-testid="add-member-button"
                    >
                      {addingMember ? "Adding..." : "Add Member"}
                    </Button>
                  </div>

                {/* Members List */}
                {showMembers && (
                  <div className="space-y-2">
                    {loadingMembers ? (
                      <div className="text-center py-2">
                        <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                      </div>
                    ) : (
                      groupMembers.map((member) => (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between p-2 rounded-lg bg-background"
                          data-testid={`member-${member.userId}`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={member.avatar} alt={member.displayName} />
                              <AvatarFallback className="text-xs">
                                {member.displayName?.substring(0, 1)?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{member.displayName || 'Unknown User'}</span>
                            <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-xs">
                              {member.role}
                            </Badge>
                          </div>
                          {member.role !== 'owner' && group.userRole === 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive h-6 px-2"
                              onClick={() => removeMemberFromGroup(member.userId)}
                              data-testid={`remove-member-${member.userId}`}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
                </div>
              )}

              {/* Chat & Group Actions - Owner only */}
              {group.userRole === 'owner' && (
              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium">Group Actions</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/groups/${groupId}/invite`)}
                    data-testid="manage-invites"
                  >
                    Manage Invites
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingGroup}
                    data-testid="delete-group-from-edit"
                  >
                    {deletingGroup ? "Deleting..." : "Delete Group"}
                  </Button>
                </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Feed */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-y-auto px-4 pb-[128px] md:pb-6"
        onScroll={(e) => {
          const target = e.target as HTMLElement;
          
          // Load more posts when scrolling to top
          if (target.scrollTop === 0 && hasMore && !loadingMore) {
            loadMorePosts();
          }
          
          // Determine if user is near bottom (for auto-scroll)
          const isNearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 100;
          setAutoScroll(isNearBottom);
        }}
      >
        {loadingMore && (
          <div className="text-center py-4">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          </div>
        )}
        
        {/* Event reminder banner */}
        {groupId && <EventReminderBanner groupId={groupId} />}
        
        <div className="space-y-3"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderPost(posts[virtualItem.index])}
            </div>
          ))}
          
          {/* Typing indicators */}
          {typingMembers.length > 0 && (
            <div className="flex gap-3 mb-4 opacity-60">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(typingMembers[0].displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{typingMembers[0].displayName}</span>
                  {typingMembers.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      and {typingMembers.length - 1} other{typingMembers.length > 2 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="bg-muted rounded-lg px-3 py-2 max-w-md">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-150"></div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">typing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div ref={messagesEndRef} />
        
        {/* Show nudge when no posts or no recent activity (24h) and user is near bottom */}
        {groupId && shouldShowNudge() && (
          <FeedNudgeCard groupId={groupId} className="mx-4 mb-4" />
        )}
        
        {posts.length === 0 && !loading && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground">
              Be the first to share something with the group!
            </p>
          </div>
        )}
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <>
          {/* Overlay to close emoji picker */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowEmojiPicker(null)}
            onTouchEnd={() => setShowEmojiPicker(null)}
          />
          
          {/* Emoji picker bar */}
          <div
            className="fixed z-50 bg-background border rounded-full shadow-lg px-3 py-2 flex gap-2"
            style={{
              left: `${emojiPickerPosition.x}px`,
              top: `${emojiPickerPosition.y}px`,
              transform: 'translateX(-50%)'
            }}
            data-testid="emoji-picker"
          >
            {REACTION_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                size="sm"
                variant="ghost"
                className="text-lg p-1 h-auto w-auto hover:bg-muted rounded-full"
                onClick={() => {
                  if (showEmojiPicker) {
                    toggleReaction(showEmojiPicker, emoji);
                  }
                  setShowEmojiPicker(null);
                }}
                data-testid={`emoji-${emoji}`}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </>
      )}

      {/* Composer */}
      <div className="sticky bottom-0 flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur-sm" style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}>
        {/* Cross-post selector */}
        {crossPost && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Post to groups:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowGroupSelect(true);
                  loadAvailableGroups();
                }}
              >
                Select Groups ({selectedGroups.length})
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{group.name}</Badge>
              {availableGroups
                .filter(g => selectedGroups.includes(g.id))
                .map(g => (
                  <Badge key={g.id} variant="secondary">{g.name}</Badge>
                ))}
            </div>
          </div>
        )}
        
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Textarea
              placeholder="Type a message..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                // Set typing indicator
                if (e.target.value.trim() && !isTyping) {
                  setTyping(true);
                } else if (!e.target.value.trim() && isTyping) {
                  setTyping(false);
                }
              }}
              onBlur={() => setTyping(false)}
              className="min-h-[44px] max-h-24 resize-none leading-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSendMessage();
                  setTyping(false);
                }
              }}
              data-testid="message-input"
              aria-label="Type a message to the group"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowWorkoutModal(true);
                loadRecentWorkouts();
              }}
              className="h-11 px-3 leading-none"
              data-testid="share-workout-button"
              aria-label="Share a workout"
            >
              <Dumbbell className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPRModal(true)}
              className="h-11 px-3 leading-none"
              data-testid="share-pr-button"
              aria-label="Share a personal record"
            >
              <Trophy className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || posting}
              className="h-11 px-3 leading-none"
              data-testid="send-button"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Switch
              id="cross-post"
              checked={crossPost}
              onCheckedChange={setCrossPost}
              data-testid="cross-post-toggle"
            />
            <Label htmlFor="cross-post" className="text-sm">
              Post to multiple groups
            </Label>
          </div>
          
          <div className="text-xs text-muted-foreground">
            ⌘+Enter to send
          </div>
        </div>
      </div>

      {/* Workout sharing modal */}
      <Dialog open={showWorkoutModal} onOpenChange={setShowWorkoutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share a Workout</DialogTitle>
          </DialogHeader>
          
          {loadingWorkouts ? (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading workouts...</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentWorkouts.map((workout) => (
                <Card
                  key={workout.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleShareWorkout(workout)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Dumbbell className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{workout.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {workout.category} • {workout.duration}min • {formatWorkoutDate(workout.createdAt)}
                  </div>
                </Card>
              ))}
              
              {recentWorkouts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No recent workouts found
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PR sharing modal */}
      <Dialog open={showPRModal} onOpenChange={setShowPRModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share a Personal Record</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="movement">Movement</Label>
              <Input
                id="movement"
                placeholder="e.g., Back Squat, Bench Press"
                value={prForm.movement}
                onChange={(e) => setPRForm(prev => ({ ...prev, movement: e.target.value }))}
                data-testid="pr-movement-input"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reps">Reps</Label>
                <Select 
                  value={prForm.reps.toString()} 
                  onValueChange={(value) => setPRForm(prev => ({ ...prev, reps: parseInt(value) }))}
                >
                  <SelectTrigger data-testid="pr-reps-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map(rep => (
                      <SelectItem key={rep} value={rep.toString()}>{rep}RM</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="weight">Weight</Label>
                <div className="flex gap-2">
                  <Input
                    id="weight"
                    type="number"
                    placeholder="0"
                    value={prForm.weight || ''}
                    onChange={(e) => setPRForm(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                    data-testid="pr-weight-input"
                  />
                  <Select 
                    value={prForm.unit} 
                    onValueChange={(value: "kg" | "lbs") => setPRForm(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger className="w-20" data-testid="pr-unit-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lbs">lbs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowPRModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSharePR}
                disabled={!prForm.movement || !prForm.weight || prForm.weight <= 0}
                className="flex-1"
                data-testid="share-pr-submit"
              >
                Share PR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group selection modal */}
      <Dialog open={showGroupSelect} onOpenChange={setShowGroupSelect}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Groups to Post To</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            <div className="flex items-center space-x-2 p-2 rounded border bg-muted">
              <Checkbox checked disabled />
              <Avatar className="w-6 h-6">
                <AvatarImage src={group.photoUrl} alt={group.name} />
                <AvatarFallback className="text-xs">
                  {getInitials(group.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{group.name}</span>
              <Badge variant="outline" className="ml-auto">Current</Badge>
            </div>
            
            {availableGroups.map((availableGroup) => (
              <div key={availableGroup.id} className="flex items-center space-x-2 p-2 rounded border">
                <Checkbox
                  checked={selectedGroups.includes(availableGroup.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedGroups(prev => [...prev, availableGroup.id]);
                    } else {
                      setSelectedGroups(prev => prev.filter(id => id !== availableGroup.id));
                    }
                  }}
                  data-testid={`group-checkbox-${availableGroup.id}`}
                />
                <Avatar className="w-6 h-6">
                  <AvatarImage src={availableGroup.photoUrl} alt={availableGroup.name} />
                  <AvatarFallback className="text-xs">
                    {getInitials(availableGroup.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{availableGroup.name}</span>
                <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  {availableGroup.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {availableGroup.memberCount} members
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowGroupSelect(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowGroupSelect(false)}
              className="flex-1"
            >
              Select ({selectedGroups.length} groups)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent data-testid="leave-group-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{group?.name}"? You'll need an invitation to rejoin this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="leave-cancel-button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={leavingGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="leave-confirm-button"
            >
              {leavingGroup ? "Leaving..." : "Leave Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="delete-group-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{group?.name}"? This action cannot be undone. All posts, messages, and group data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={deletingGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="delete-confirm-button"
            >
              {deletingGroup ? "Deleting..." : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}