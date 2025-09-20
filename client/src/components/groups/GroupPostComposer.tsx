import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface GroupPostComposerProps {
  groupId: string;
  className?: string;
  onPostCreated?: () => void;
}

export function GroupPostComposer({ groupId, className, onPostCreated }: GroupPostComposerProps) {
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || posting) return;

    try {
      setPosting(true);
      setTyping(false); // Stop typing indicator
      
      const response = await authFetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "text",
          content: { message: message.trim() },
          groupIds: [groupId],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create post");
      }

      // Clear the message
      setMessage("");
      
      // Call callback
      onPostCreated?.();
      
      // Success toast
      toast({
        title: "Post created",
        description: "Your message has been posted to the group.",
      });
      
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

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Text Post</Badge>
            <span>Press ⌘+Enter to send</span>
          </div>
          <span>{message.length}/1000</span>
        </div>
      </form>
    </Card>
  );
}