import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Dumbbell, 
  Target, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Trophy
} from "lucide-react";
import { EventRsvpButtons } from "./EventRsvpButtons";
import { formatDistanceToNow } from "date-fns";

interface GroupWorkoutEventCardProps {
  post: {
    id: string;
    kind: string;
    content: {
      title: string;
      description: string;
      start_at?: string;
      startAt?: string; // fallback for camelCase
      duration_min?: number;
      durationMinutes?: number; // fallback for camelCase
      location?: string;
      workoutData?: {
        name: string;
        description: string;
        duration: number;
        intensity: number;
        category: string;
        sets: any[];
      };
    };
    authorName: string;
    authorAvatar?: string;
    createdAt: string;
  };
  groupId: string;
  onContextMenu?: (e: React.MouseEvent, postId: string) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export function GroupWorkoutEventCard({
  post,
  groupId,
  onContextMenu,
  onTouchStart,
  onTouchEnd
}: GroupWorkoutEventCardProps) {
  const [showWorkoutDetails, setShowWorkoutDetails] = useState(false);
  const workoutData = post.content.workoutData;
  // Handle both snake_case and camelCase field names for robustness
  const startAt = post.content.start_at || post.content.startAt;
  const durationMin = post.content.duration_min || post.content.durationMinutes;
  const eventDate = startAt ? new Date(startAt) : new Date();
  const isUpcoming = eventDate > new Date() && !isNaN(eventDate.getTime());
  
  return (
    <Card 
      className="rounded-2xl bg-zinc-900/70 border border-white/10 p-5 md:p-6 space-y-5 cursor-pointer break-words"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, post.id) : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-testid={`group-workout-post-${post.id}`}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <Dumbbell className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg md:text-xl font-semibold text-white/90">{post.content.title}</h3>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Avatar className="w-5 h-5">
              {post.authorAvatar ? (
                <AvatarImage src={post.authorAvatar} alt={post.authorName} />
              ) : (
                <AvatarFallback className="text-xs">
                  {post.authorName.substring(0, 1).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <span>{post.authorName}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
        {isUpcoming && (
          <div className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-medium">
            Upcoming
          </div>
        )}
      </div>

      {/* Event Details */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-white/90">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="font-medium">{eventDate.toLocaleDateString()}</span>
          <Clock className="w-5 h-5 text-white/70 ml-3" />
          <span>{eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        
        <div className="flex items-center gap-3 text-white/70">
          <Target className="w-5 h-5" />
          <span>{durationMin || 60} minutes</span>
          {post.content.location && (
            <>
              <MapPin className="w-5 h-5 ml-3" />
              <span>{post.content.location}</span>
            </>
          )}
        </div>
      </div>

      {/* Workout Summary */}
      {workoutData && (
        <div className="bg-background/50 rounded-lg p-4 mb-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-chart-2" />
              <span className="font-medium text-sm">{workoutData.category}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowWorkoutDetails(!showWorkoutDetails);
              }}
              className="h-6 px-2 text-xs"
              data-testid={`toggle-workout-details-${post.id}`}
            >
              {showWorkoutDetails ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Details
                </>
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed">
            {workoutData.description}
          </p>
          
          {/* Workout Stats */}
          <div className="grid grid-cols-1 gap-4 mt-3 text-center">
            <div>
              <div className="text-lg font-bold text-chart-3">{workoutData.sets?.length || 0}</div>
              <div className="text-xs text-muted-foreground">exercises</div>
            </div>
          </div>

          {/* Expanded Workout Details */}
          {showWorkoutDetails && workoutData.sets && workoutData.sets.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Workout Plan
              </h4>
              <div className="space-y-3 max-h-32 overflow-y-auto">
                {workoutData.sets.slice(0, 5).map((set: any, index: number) => (
                  <div key={index} className="text-xs">
                    <div className="font-medium text-foreground">{set.exercise}</div>
                    {(set.reps || set.weight || set.duration) && (
                      <div className="text-muted-foreground">
                        {set.reps && `${set.reps} reps`}
                        {set.weight && ` • ${set.weight} lbs`}
                        {set.duration && ` • ${set.duration}s`}
                      </div>
                    )}
                  </div>
                ))}
                {workoutData.sets.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    +{workoutData.sets.length - 5} more exercises...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RSVP Section */}
      <div className="border-t border-border/50 pt-3">
        <div className="flex items-center gap-3 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Who's joining?</span>
        </div>
        <EventRsvpButtons postId={post.id} groupId={groupId} />
      </div>
    </Card>
  );
}