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
  ExternalLink
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import { formatDistanceToNow } from "date-fns";

// Emoji picker emojis
const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '🙌'];

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

      const url = new URL(`/api/groups/${groupId}/feed`, window.location.origin);
      if (before) url.searchParams.set('before', before);
      url.searchParams.set('limit', POSTS_PER_PAGE.toString());

      const response = await authFetch(url.toString());
      if (response.ok) {
        const newPosts = await response.json();
        
        if (before) {
          // Prepend older posts (for infinite up scroll)
          setPosts(prev => [...newPosts, ...prev]);
        } else {
          // Initial load
          setPosts(newPosts);
        }
        
        setHasMore(newPosts.length === POSTS_PER_PAGE);
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

  const handleSendMessage = async () => {
    if (!message.trim() || posting) return;

    const targetGroups = crossPost && selectedGroups.length > 0 ? selectedGroups : [groupId!];
    
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
        // Don't add locally - let real-time handle it to avoid duplication
        setMessage("");
        setCrossPost(false);
        setSelectedGroups([]);
        
        toast({
          title: "Message sent!",
          description: crossPost ? `Posted to ${targetGroups.length} groups` : "Posted to group",
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
    if (!groupId) return;

    // Optimistic update
    const currentReactions = postReactions[postId] || [];
    const existingReaction = currentReactions.find(r => r.emoji === emoji);
    
    let optimisticReactions: Reaction[];
    if (existingReaction?.userReacted) {
      // Remove reaction
      optimisticReactions = currentReactions.map(r => 
        r.emoji === emoji 
          ? { ...r, count: r.count - 1, userReacted: false, users: r.users.filter(u => u.id !== 'current-user') }
          : r
      ).filter(r => r.count > 0);
    } else {
      // Add reaction
      if (existingReaction) {
        optimisticReactions = currentReactions.map(r => 
          r.emoji === emoji 
            ? { ...r, count: r.count + 1, userReacted: true, users: [...r.users, { id: 'current-user', name: 'You' }] }
            : r
        );
      } else {
        optimisticReactions = [...currentReactions, { 
          emoji, 
          count: 1, 
          userReacted: true, 
          users: [{ id: 'current-user', name: 'You' }] 
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

  const getInitials = (name: string) => {
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
      <div key={post.id} className="flex gap-3 mb-4">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={post.authorAvatar} alt={post.authorName} />
          <AvatarFallback className="text-xs">
            {getInitials(post.authorName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{post.authorName}</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          
          {post.kind === "text" && (
            <div 
              className="bg-muted rounded-lg px-3 py-2 max-w-md cursor-pointer"
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
              data-testid={`post-${post.id}`}
            >
              <p className="text-sm">{post.content.message}</p>
            </div>
          )}
          
          {post.kind === "workout" && (
            <Card 
              className="p-3 max-w-md cursor-pointer"
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
              data-testid={`post-${post.id}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">{post.content.name}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                {post.content.category} • {post.content.duration}min • Intensity {post.content.intensity}/10
              </div>
              <Button size="sm" variant="outline" className="text-xs h-7">
                <ExternalLink className="w-3 h-3 mr-1" />
                View workout
              </Button>
            </Card>
          )}
          
          {post.kind === "pr" && (
            <div 
              className="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-full px-3 py-1 max-w-fit cursor-pointer"
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
              data-testid={`post-${post.id}`}
            >
              <div className="flex items-center gap-1 text-sm">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="font-medium">New PR:</span>
                <span>{post.content.reps}RM {post.content.movement} {post.content.weight}{post.content.unit}</span>
                <span>🎉</span>
              </div>
            </div>
          )}
          
          {post.kind === "event" && (
            <Card 
              className="p-3 max-w-md cursor-pointer"
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
              data-testid={`post-${post.id}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">{post.content.title}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{post.content.description}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="text-xs h-7">
                  <Check className="w-3 h-3 mr-1" />
                  I'm in
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7">
                  <Bell className="w-3 h-3 mr-1" />
                  Remind me
                </Button>
              </div>
            </Card>
          )}
          
          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {reactions.map((reaction) => (
                <Button
                  key={reaction.emoji}
                  size="sm"
                  variant={reaction.userReacted ? "default" : "outline"}
                  className="text-xs h-7 px-2 rounded-full"
                  onClick={() => toggleReaction(post.id, reaction.emoji)}
                  data-testid={`reaction-${reaction.emoji}-${post.id}`}
                >
                  <span className="mr-1">{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/groups")}
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <Avatar className="w-8 h-8">
            <AvatarImage src={group.photoUrl} alt={group.name} />
            <AvatarFallback className="text-xs">
              {getInitials(group.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{group.name}</h1>
              {group.isPublic ? (
                <Globe className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/groups/${groupId}/invite`)}
            data-testid="invite-button"
          >
            <Users className="w-4 h-4 mr-2" />
            Invite
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-auto p-4"
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
        
        <div
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
      <div className="flex-shrink-0 p-4 border-t bg-background">
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
              className="min-h-[40px] max-h-24 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSendMessage();
                  setTyping(false);
                }
              }}
              data-testid="message-input"
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
              data-testid="share-workout-button"
            >
              <Dumbbell className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPRModal(true)}
              data-testid="share-pr-button"
            >
              <Trophy className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || posting}
              data-testid="send-button"
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
                    {workout.category} • {workout.duration}min • {formatDistanceToNow(new Date(workout.createdAt), { addSuffix: true })}
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
    </div>
  );
}