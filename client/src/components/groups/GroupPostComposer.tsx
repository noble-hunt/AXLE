import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Calendar, Clock } from "lucide-react";
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from '@/lib/supabase';
import type { GroupPost } from '@/features/groups/api';

interface GroupPostComposerProps {
  groupId: string;
  className?: string;
  onPostCreated?: () => void;
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
}

export function GroupPostComposer({ groupId, className, onPostCreated, setPosts }: GroupPostComposerProps) {
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [postKind, setPostKind] = useState<"text" | "event">("text");
  
  // Event-specific fields
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartAt, setEventStartAt] = useState("");
  const [eventDurationMin, setEventDurationMin] = useState(60);
  const [eventLocation, setEventLocation] = useState("");
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  
  // Get typing functions from real-time hook
  const { setTyping, typingMembers } = useGroupRealtime(groupId);

  // Handle typing indicators
  useEffect(() => {
    const handleTyping = () => {
      if (message.trim()) {
        setTyping(true);
      } else {
        setTyping(false);
      }
    };

    // Debounce typing indicator
    const timeoutId = setTimeout(handleTyping, 300);
    return () => clearTimeout(timeoutId);
  }, [message, setTyping]);

  // Stop typing when component unmounts
  useEffect(() => {
    return () => setTyping(false);
  }, [setTyping]);

  const handleTonightAction = () => {
    // Set to event mode with prefilled 7pm tonight
    setPostKind("event");
    const now = new Date();
    const tonight = new Date(now);
    tonight.setHours(19, 0, 0, 0); // 7:00 PM
    
    // If it's already past 7pm today, set for tomorrow
    if (now.getHours() >= 19) {
      tonight.setDate(tonight.getDate() + 1);
    }
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm) in local time
    const year = tonight.getFullYear();
    const month = String(tonight.getMonth() + 1).padStart(2, '0');
    const day = String(tonight.getDate()).padStart(2, '0');
    const hours = String(tonight.getHours()).padStart(2, '0');
    const minutes = String(tonight.getMinutes()).padStart(2, '0');
    const localDateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    setEventTitle("Working out tonight?");
    setEventStartAt(localDateTimeString);
    setEventDurationMin(60);
    setEventLocation("");
    setMessage("");
  };

  const sendPost = async (text: string, meta: any = null) => {
    const body = text.trim();
    if (!body) return;

    const userId = (await supabase.auth.getUser()).data.user?.id!;
    const temp: GroupPost & { _status?: 'sending'|'failed' } = {
      id: -Math.floor(Math.random() * 1e9),
      group_id: groupId,
      author_id: userId,
      body,
      meta,
      created_at: new Date().toISOString(),
      _status: 'sending',
    };
    setPosts(p => [temp, ...p]);

    // direct supabase (recommended)
    const { data, error } = await supabase
      .from('group_posts')
      .insert({ group_id: groupId, body, meta })
      .select('*').single();

    if (error || !data) {
      setPosts(p => p.map(x => x.id === temp.id ? { ...x, _status: 'failed' } : x));
      toast({
        title: "Failed to send message",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
      return;
    }

    setPosts(p => {
      const withoutTemp = p.filter(x => x.id !== temp.id && x.id !== data.id);
      return [data as GroupPost, ...withoutTemp];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on post type
    if (postKind === "text" && (!message.trim() || posting)) return;
    if (postKind === "event" && (!eventTitle.trim() || !eventStartAt || posting)) return;

    try {
      setPosting(true);
      setTyping(false); // Stop typing indicator
      
      if (postKind === "event") {
        const eventMeta = {
          kind: "event",
          title: eventTitle.trim(),
          start_at: new Date(eventStartAt).toISOString(),
          duration_min: eventDurationMin,
          ...(eventLocation.trim() ? { location: eventLocation.trim() } : {}),
        };
        await sendPost(eventTitle.trim(), eventMeta);
      } else {
        await sendPost(message.trim());
      }

      // Clear the form
      setMessage("");
      setEventTitle("");
      setEventStartAt("");
      setEventDurationMin(60);
      setEventLocation("");
      setPostKind("text");
      
      // Call callback
      onPostCreated?.();
      
    } catch (error) {
      console.error("Failed to create post:", error);
      toast({
        title: "Failed to post",
        description: error instanceof Error ? error.message : "Unable to create post",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <Card className={cn("p-4", className)}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Quick Actions */}
        {postKind === "text" && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTonightAction}
              className="text-xs"
              data-testid="tonight-quick-action"
            >
              <Calendar className="w-3 h-3 mr-1" />
              Tonight?
            </Button>
          </div>
        )}

        {/* Typing indicators for others */}
        {typingMembers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <span>
              {typingMembers.length === 1 
                ? `${typingMembers[0].displayName} is typing...`
                : `${typingMembers.length} people are typing...`}
            </span>
          </div>
        )}

        {/* Event Form */}
        {postKind === "event" && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Create Event
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPostKind("text")}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
            
            <div className="space-y-2">
              <Input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Event title (e.g., Working out tonight?)"
                data-testid="event-title-input"
              />
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Start Time</label>
                  <input
                    type="datetime-local"
                    value={eventStartAt}
                    onChange={(e) => setEventStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
                    data-testid="event-start-input"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={eventDurationMin}
                    onChange={(e) => setEventDurationMin(parseInt(e.target.value) || 60)}
                    min={15}
                    max={480}
                    data-testid="event-duration-input"
                  />
                </div>
              </div>
              
              <Input
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Location (optional)"
                data-testid="event-location-input"
              />
            </div>
          </div>
        )}

        {/* Text Form */}
        {postKind === "text" && (
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share something with the group..."
              className="min-h-[80px] pr-12 resize-none"
              data-testid="post-composer-input"
              disabled={posting}
            />
            <Button
              type="submit"
              size="sm"
              className="absolute bottom-2 right-2 h-8 w-8 p-0"
              disabled={!message.trim() || posting}
              data-testid="post-submit-button"
            >
              {posting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}

        {/* Event Form Submit */}
        {postKind === "event" && (
          <Button
            type="submit"
            className="w-full"
            disabled={!eventTitle.trim() || !eventStartAt || posting}
            data-testid="event-submit-button"
          >
            {posting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Event...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Create Event
              </>
            )}
          </Button>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {postKind === "event" ? "Event Post" : "Text Post"}
            </Badge>
            {postKind === "text" && <span>Press ⌘+Enter to send</span>}
          </div>
          {postKind === "text" && <span>{message.length}/1000</span>}
        </div>
      </form>
    </Card>
  );
}