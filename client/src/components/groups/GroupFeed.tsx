import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Users, Eye } from "lucide-react";
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import { authFetch } from "@/lib/authFetch";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface GroupPost {
  id: string;
  userId: string;
  kind: "text" | "workout" | "pr" | "event";
  content: Record<string, any>;
  createdAt: string;
  groupCreatedAt: string;
  authorUsername: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarUrl: string;
}

interface GroupFeedProps {
  groupId: string;
  className?: string;
}

export function GroupFeed({ groupId, className }: GroupFeedProps) {
  const { user } = useAppStore();
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPostsIndicator, setShowNewPostsIndicator] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  
  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Real-time callbacks
  const handleNewPost = useCallback(async (groupPost: any) => {
    try {
      // Fetch the complete post data
      const response = await authFetch(`/api/groups/${groupId}/feed?after=${groupPost.created_at}&limit=1`);
      if (response.ok) {
        const newPosts = await response.json();
        if (newPosts.length > 0) {
          setPosts(prev => [...prev, ...newPosts]);
          
          // If user is near bottom, auto-scroll
          if (isNearBottom) {
            setTimeout(() => {
              feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          } else {
            // Show new posts indicator
            setNewPostsCount(prev => prev + 1);
            setShowNewPostsIndicator(true);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch new post:', error);
    }
  }, [groupId, isNearBottom]);

  const handleNewReaction = useCallback((reaction: any) => {
    console.log('New reaction received:', reaction);
    // Could refresh reaction counts here if needed
  }, []);

  const handleReactionRemoved = useCallback((reaction: any) => {
    console.log('Reaction removed:', reaction);
    // Could refresh reaction counts here if needed
  }, []);

  // Use real-time hook
  const { onlineMembers, typingMembers, setTyping } = useGroupRealtime(
    groupId,
    handleNewPost,
    handleNewReaction,
    handleReactionRemoved
  );

  // Load initial posts
  useEffect(() => {
    async function loadPosts() {
      try {
        setLoading(true);
        const response = await authFetch(`/api/groups/${groupId}/feed?limit=50`);
        if (response.ok) {
          const feedData = await response.json();
          setPosts(feedData);
          
          // Auto-scroll to bottom after loading
          setTimeout(() => {
            feedEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }, 100);
        }
      } catch (error) {
        console.error('Failed to load posts:', error);
      } finally {
        setLoading(false);
      }
    }

    if (groupId) {
      loadPosts();
    }
  }, [groupId]);

  // Scroll detection
  const handleScroll = useCallback(() => {
    if (!feedContainerRef.current) return;
    
    const container = feedContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 200;
    
    setIsNearBottom(nearBottom);
    
    if (nearBottom && showNewPostsIndicator) {
      setShowNewPostsIndicator(false);
      setNewPostsCount(0);
    }
  }, [showNewPostsIndicator]);

  useEffect(() => {
    const container = feedContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const scrollToBottom = () => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewPostsIndicator(false);
    setNewPostsCount(0);
  };

  const formatDisplayName = (post: GroupPost) => {
    if (post.authorFirstName && post.authorLastName) {
      return `${post.authorFirstName} ${post.authorLastName}`;
    }
    return post.authorUsername || 'Anonymous';
  };

  const formatPostContent = (post: GroupPost) => {
    switch (post.kind) {
      case 'text':
        return post.content.message || 'No message';
      case 'workout':
        return `🏋️ Shared a workout: ${post.content.workout_id}`;
      case 'pr':
        return `🏆 New PR: ${post.content.weight_kg}kg ${post.content.movement} (${post.content.rep_max}RM)`;
      case 'event':
        return `📅 Event: ${post.content.title} at ${post.content.start_at}`;
      default:
        return 'Unknown post type';
    }
  };

  if (loading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading feed...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* Online members indicator */}
      {onlineMembers.length > 0 && (
        <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {onlineMembers.length} member{onlineMembers.length !== 1 ? 's' : ''} online
          </span>
          <div className="flex gap-1">
            {onlineMembers.slice(0, 5).map((member, index) => (
              <div
                key={member.userId}
                className="w-2 h-2 rounded-full bg-green-500"
                title={member.displayName}
              />
            ))}
            {onlineMembers.length > 5 && (
              <span className="text-xs text-muted-foreground">+{onlineMembers.length - 5}</span>
            )}
          </div>
        </div>
      )}

      {/* Feed content */}
      <div 
        ref={feedContainerRef}
        className="flex-1 overflow-y-auto space-y-4 p-4"
      >
        {posts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No posts yet. Be the first to post!</p>
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="p-4" data-testid={`post-${post.id}`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  {post.authorFirstName?.[0] || post.authorUsername?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">
                      {formatDisplayName(post)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {post.kind}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    {formatPostContent(post)}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}

        {/* Typing indicators */}
        {typingMembers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            {typingMembers.length === 1 
              ? `${typingMembers[0].displayName} is typing...`
              : `${typingMembers.length} people are typing...`}
          </div>
        )}

        <div ref={feedEndRef} />
      </div>

      {/* New posts indicator */}
      {showNewPostsIndicator && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            onClick={scrollToBottom}
            className="shadow-lg"
            data-testid="new-posts-indicator"
          >
            <ChevronDown className="w-4 h-4 mr-1" />
            {newPostsCount > 0 ? `${newPostsCount} new post${newPostsCount !== 1 ? 's' : ''}` : 'New posts'} ↓
          </Button>
        </div>
      )}
    </div>
  );
}