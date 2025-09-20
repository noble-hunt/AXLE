import { useState, useEffect } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Calendar, Clock, MapPin } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface EventPost {
  id: string;
  content: {
    title: string;
    start_at: string;
    duration_min: number;
    location?: string;
  };
}

interface Rsvp {
  userId: string;
  status: "going" | "maybe" | "no";
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    username: string;
  };
}

interface EventReminderBannerProps {
  groupId: string;
}

export function EventReminderBanner({ groupId }: EventReminderBannerProps) {
  const [dismissedEvents, setDismissedEvents] = useState<Set<string>>(new Set());
  const { user } = useAppStore();

  // Load group posts to find events
  const { data: posts = [] } = useQuery<EventPost[]>({
    queryKey: ['/api/groups', groupId, 'feed'],
    select: (data: any[]) => data.filter((post: any) => post.kind === 'event'),
  });

  // Find events starting within the next hour that user is going to
  const upcomingEvents = posts.filter((post) => {
    if (!post.content?.start_at || dismissedEvents.has(post.id)) {
      return false;
    }

    const eventTime = new Date(post.content.start_at);
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Check if event is within the next hour
    return eventTime >= now && eventTime <= oneHourFromNow;
  });

  // Load RSVP status for each upcoming event using useQueries
  const eventRsvpQueries = useQueries({
    queries: upcomingEvents.map((event) => ({
      queryKey: ['/api/groups', groupId, 'posts', event.id, 'rsvps'],
      enabled: upcomingEvents.length > 0,
    })),
  });

  // Filter events where user is going
  const eventsUserIsGoingTo = upcomingEvents.filter((event, index) => {
    const rsvps = (eventRsvpQueries[index]?.data as Rsvp[]) || [];
    const userRsvp = rsvps.find(rsvp => rsvp.userId === user?.id);
    return userRsvp?.status === 'going';
  });

  const handleDismiss = (eventId: string) => {
    setDismissedEvents(prev => new Set(prev).add(eventId));
  };

  if (eventsUserIsGoingTo.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {eventsUserIsGoingTo.map((event) => {
        const startTime = new Date(event.content.start_at);
        const timeUntil = formatDistanceToNow(startTime);

        return (
          <Card 
            key={event.id} 
            className={cn(
              "p-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20",
              "animate-in slide-in-from-top-2 duration-300"
            )}
            data-testid={`reminder-${event.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
                    Upcoming Event
                  </span>
                </div>
                
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {event.content.title}
                </h4>
                
                <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Starts in {timeUntil}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {event.content.duration_min} min
                  </div>
                  
                  {event.content.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.content.location}
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(event.id)}
                className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                data-testid={`dismiss-reminder-${event.id}`}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Dismiss reminder</span>
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}