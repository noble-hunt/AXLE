import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Dumbbell, Calendar, Share } from "lucide-react";
import { useLocation } from "wouter";

interface FeedNudgeCardProps {
  groupId: string;
  className?: string;
}

export function FeedNudgeCard({ groupId, className }: FeedNudgeCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [, setLocation] = useLocation();

  if (dismissed) return null;

  const handleGenerateWorkout = () => {
    // Navigate to group workout generation with group context
    setLocation(`/workout/generate?groupId=${groupId}&mode=group`);
  };

  const handleSyncTonight = () => {
    // Focus on message input and suggest evening workout
    const messageInput = document.querySelector('[data-testid="message-input"]') as HTMLTextAreaElement;
    if (messageInput) {
      messageInput.focus();
      messageInput.value = "Let's sync up for a workout tonight! Who's in? 🏋️‍♀️";
      // Trigger input event to update the component state
      const event = new Event('input', { bubbles: true });
      messageInput.dispatchEvent(event);
      messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSharePlan = () => {
    // Focus on message input and pre-fill for sharing workout plan
    const messageInput = document.querySelector('[data-testid="message-input"]') as HTMLTextAreaElement;
    if (messageInput) {
      messageInput.focus();
      messageInput.value = "Here's my workout plan for today: ";
      // Trigger input event to update the component state
      const event = new Event('input', { bubbles: true });
      messageInput.dispatchEvent(event);
      messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <Card className={`rounded-2xl bg-zinc-900/70 border border-white/10 p-6 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Dumbbell className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold text-white/90">Go move! 🔥</h3>
          <Badge variant="secondary" className="bg-white/15 text-white/80 text-xs">
            Nudge
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          data-testid="button-dismiss-nudge"
          className="h-8 w-8 p-0 text-white/60 hover:text-white/90 hover:bg-white/10"
          aria-label="Dismiss nudge"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <p className="text-white/70 text-sm leading-relaxed">
        It's been quiet here lately. Time to get the group moving! 💪
      </p>
      
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleGenerateWorkout}
          size="sm"
          className="flex items-center gap-2 h-9 leading-none"
          data-testid="button-generate-workout"
          aria-label="Generate group workout"
        >
          <Dumbbell className="w-4 h-4" />
          Generate group workout
        </Button>
        
        <Button
          onClick={handleSyncTonight}
          variant="outline" 
          size="sm"
          className="flex items-center gap-2 h-9 leading-none border-white/20 text-white/90 hover:bg-white/10"
          data-testid="button-sync-tonight"
          aria-label="Sync tonight"
        >
          <Calendar className="w-4 h-4" />
          Sync tonight
        </Button>
        
        <Button
          onClick={handleSharePlan}
          variant="outline"
          size="sm" 
          className="flex items-center gap-2 h-9 leading-none border-white/20 text-white/90 hover:bg-white/10"
          data-testid="button-share-plan"
          aria-label="Share a plan"
        >
          <Share className="w-4 h-4" />
          Share a plan
        </Button>
      </div>
    </Card>
  );
}