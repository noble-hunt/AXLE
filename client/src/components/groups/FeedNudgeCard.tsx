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
    setLocation(`/generate-workout?groupId=${groupId}&mode=group`);
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
    <Card className={`p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Go move! 🔥</h3>
          <Badge variant="secondary" className="text-xs">
            Nudge
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          data-testid="button-dismiss-nudge"
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <p className="text-muted-foreground mb-4 text-sm">
        It's been quiet here lately. Time to get the group moving! 💪
      </p>
      
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleGenerateWorkout}
          size="sm"
          className="flex items-center gap-2"
          data-testid="button-generate-workout"
        >
          <Dumbbell className="w-4 h-4" />
          Generate group workout
        </Button>
        
        <Button
          onClick={handleSyncTonight}
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
          data-testid="button-sync-tonight"
        >
          <Calendar className="w-4 h-4" />
          Sync tonight
        </Button>
        
        <Button
          onClick={handleSharePlan}
          variant="outline"
          size="sm" 
          className="flex items-center gap-2"
          data-testid="button-share-plan"
        >
          <Share className="w-4 h-4" />
          Share a plan
        </Button>
      </div>
    </Card>
  );
}