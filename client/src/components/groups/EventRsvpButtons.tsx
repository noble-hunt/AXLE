import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, HelpCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface RsvpUser {
  id: string;
  firstName?: string;
  lastName?: string; 
  username: string;
  profilePicture?: string;
}

interface Rsvp {
  userId: string;
  status: "going" | "maybe" | "no";
  user: RsvpUser;
}

interface EventRsvpButtonsProps {
  postId: string;
  groupId: string;
}

export function EventRsvpButtons({ postId, groupId }: EventRsvpButtonsProps) {
  const { toast } = useToast();
  const { user } = useAppStore();

  // Load RSVPs with TanStack Query
  const { data: rsvps = [], isLoading } = useQuery<Rsvp[]>({
    queryKey: ['/api/groups', groupId, 'posts', postId, 'rsvps'],
  });

  // Current user's RSVP status
  const currentUserRsvp = rsvps.find((rsvp: Rsvp) => rsvp.userId === user?.id)?.status || null;

  // RSVP mutations
  const rsvpMutation = useMutation({
    mutationFn: async (status: "going" | "maybe" | "no") => {
      return apiRequest("POST", `/api/groups/${groupId}/posts/${postId}/rsvp`, { status });
    },
    onSuccess: (_, status) => {
      // Invalidate and refetch RSVPs
      queryClient.invalidateQueries({ 
        queryKey: ['/api/groups', groupId, 'posts', postId, 'rsvps'] 
      });
      
      const statusText = status === "going" ? "going" : status === "maybe" ? "maybe" : "not going";
      toast({
        title: "RSVP updated",
        description: `You're ${statusText} to this event.`,
      });
    },
    onError: (error) => {
      console.error("Failed to update RSVP:", error);
      toast({
        title: "Failed to RSVP",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeRsvpMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/groups/${groupId}/posts/${postId}/rsvp`);
    },
    onSuccess: () => {
      // Invalidate and refetch RSVPs
      queryClient.invalidateQueries({ 
        queryKey: ['/api/groups', groupId, 'posts', postId, 'rsvps'] 
      });
      
      toast({
        title: "RSVP removed",
        description: "Your response has been removed.",
      });
    },
    onError: (error) => {
      console.error("Failed to remove RSVP:", error);
      toast({
        title: "Failed to remove RSVP",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRsvp = (status: "going" | "maybe" | "no") => {
    if (!user) return;
    
    // If clicking the same status, remove RSVP
    if (currentUserRsvp === status) {
      removeRsvpMutation.mutate();
    } else {
      // Update or create RSVP
      rsvpMutation.mutate(status);
    }
  };

  const getInitials = (user: RsvpUser) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
    }
    return user.username[0]?.toUpperCase() || '?';
  };

  const getDisplayName = (user: RsvpUser) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
  };

  const goingCount = rsvps.filter(rsvp => rsvp.status === "going").length;
  const maybeCount = rsvps.filter(rsvp => rsvp.status === "maybe").length;
  const noCount = rsvps.filter(rsvp => rsvp.status === "no").length;

  const goingUsers = rsvps.filter(rsvp => rsvp.status === "going");
  const maybeUsers = rsvps.filter(rsvp => rsvp.status === "maybe");

  const isUpdating = rsvpMutation.isPending || removeRsvpMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* RSVP Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={currentUserRsvp === "going" ? "default" : "outline"}
          className={cn("text-xs h-7", currentUserRsvp === "going" && "bg-green-600 hover:bg-green-700")}
          onClick={() => handleRsvp("going")}
          disabled={isUpdating}
          data-testid={`rsvp-going-${postId}`}
        >
          {isUpdating && rsvpMutation.variables !== "going" ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Check className="w-3 h-3 mr-1" />
          )}
          Going {goingCount > 0 && `(${goingCount})`}
        </Button>
        
        <Button
          size="sm"
          variant={currentUserRsvp === "maybe" ? "default" : "outline"}
          className={cn("text-xs h-7", currentUserRsvp === "maybe" && "bg-yellow-600 hover:bg-yellow-700")}
          onClick={() => handleRsvp("maybe")}
          disabled={isUpdating}
          data-testid={`rsvp-maybe-${postId}`}
        >
          {isUpdating && rsvpMutation.variables !== "maybe" ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <HelpCircle className="w-3 h-3 mr-1" />
          )}
          Maybe {maybeCount > 0 && `(${maybeCount})`}
        </Button>
        
        <Button
          size="sm"
          variant={currentUserRsvp === "no" ? "default" : "outline"}
          className={cn("text-xs h-7", currentUserRsvp === "no" && "bg-red-600 hover:bg-red-700")}
          onClick={() => handleRsvp("no")}
          disabled={isUpdating}
          data-testid={`rsvp-no-${postId}`}
        >
          {isUpdating && rsvpMutation.variables !== "no" ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <X className="w-3 h-3 mr-1" />
          )}
          Not Going {noCount > 0 && `(${noCount})`}
        </Button>
      </div>

      {/* Attendee Lists */}
      {goingUsers.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-green-600">Going:</div>
          <div className="flex flex-wrap gap-1">
            {goingUsers.slice(0, 5).map((rsvp) => (
              <div key={rsvp.userId} className="flex items-center gap-1">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={rsvp.user.profilePicture} alt={getDisplayName(rsvp.user)} />
                  <AvatarFallback className="text-[8px]">
                    {getInitials(rsvp.user)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{getDisplayName(rsvp.user)}</span>
              </div>
            ))}
            {goingUsers.length > 5 && (
              <span className="text-xs text-muted-foreground">+{goingUsers.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {maybeUsers.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-yellow-600">Maybe:</div>
          <div className="flex flex-wrap gap-1">
            {maybeUsers.slice(0, 3).map((rsvp) => (
              <div key={rsvp.userId} className="flex items-center gap-1">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={rsvp.user.profilePicture} alt={getDisplayName(rsvp.user)} />
                  <AvatarFallback className="text-[8px]">
                    {getInitials(rsvp.user)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{getDisplayName(rsvp.user)}</span>
              </div>
            ))}
            {maybeUsers.length > 3 && (
              <span className="text-xs text-muted-foreground">+{maybeUsers.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}