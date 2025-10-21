import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/swift/card";
import { Button } from "@/components/swift/button";
import { Users, ChevronRight, Plus, Bell } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface UserGroup {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  isPublic: boolean;
  role: string;
  joinedAt: string;
}

export function GroupsShortcutCard() {
  const { isAuthenticated } = useAppStore();

  const { data: groups = [], isLoading, error } = useQuery<UserGroup[]>({
    queryKey: ['/api/groups'],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Show sign-in state for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Card data-testid="groups-shortcut-card-cta" className="w-full p-4">
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Groups</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Sign in to join fitness groups and connect with other athletes.
          </p>
          <Button data-testid="button-sign-in-groups" className="w-full" asChild>
            <Link href="/auth/login">
              Sign In
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  // Loading state for authenticated users
  if (isLoading) {
    return (
      <Card data-testid="groups-shortcut-card-loading" className="w-full p-4">
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Groups</h3>
          </div>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </Card>
    );
  }

  // Error state for authenticated users
  if (error) {
    return (
      <Card data-testid="groups-shortcut-card-error" className="w-full p-4">
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Groups</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Unable to load your groups right now. Please try again later.
          </p>
          <Button data-testid="button-view-groups-error" className="w-full" variant="secondary" asChild>
            <Link href="/groups">
              View Groups
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  // Empty state - no groups
  if (groups.length === 0) {
    return (
      <Card data-testid="groups-shortcut-card-empty" className="w-full p-4">
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Groups</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Create or join a group to connect with other athletes and share your fitness journey!
          </p>
          <Button data-testid="button-discover-groups" className="w-full" asChild>
            <Link href="/groups">
              <Plus className="h-4 w-4 mr-2" />
              Create or Join Group
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  // Groups exist - show shortcut with summary
  const groupCount = groups.length;
  const displayGroups = groups.slice(0, 2);
  const hasMore = groupCount > 2;

  return (
    <Link href="/groups">
      <Card 
        data-testid="groups-shortcut-card" 
        className="w-full p-4 active:scale-98 transition-transform cursor-pointer hover:shadow-md"
      >
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Your Groups</h3>
            <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {groupCount}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Render groups based on count */}
          {groupCount === 1 ? (
            // Single group - centered
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                {displayGroups[0].photoUrl ? (
                  <img 
                    src={displayGroups[0].photoUrl} 
                    alt={displayGroups[0].name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{displayGroups[0].name}</p>
                <p className="text-xs text-muted-foreground capitalize">{displayGroups[0].role}</p>
              </div>
            </div>
          ) : (
            // 2 or more groups - side by side
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                {displayGroups.map((group) => (
                  <div key={group.id} className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                      {group.photoUrl ? (
                        <img 
                          src={group.photoUrl} 
                          alt={group.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="text-center min-w-0 w-full px-1">
                      <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{group.role}</p>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <p className="text-xs text-muted-foreground">
                  +{groupCount - 2} more {groupCount - 2 === 1 ? 'group' : 'groups'}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-xs text-primary pt-2">
            <Bell className="h-3.5 w-3.5" />
            <span>Tap to view all activity</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
