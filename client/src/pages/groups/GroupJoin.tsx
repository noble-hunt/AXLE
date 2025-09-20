import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Users, Lock, Globe, CheckCircle, AlertCircle } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";

interface Group {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  isPublic: boolean;
  memberCount?: number;
}

export default function GroupJoin() {
  // Handle both /groups/join/:id and /join/:code routes  
  const [, groupJoinParams] = useRoute("/groups/join/:id");
  const [, inviteCodeParams] = useRoute("/join/:code");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isInviteCodeRoute, setIsInviteCodeRoute] = useState(false);

  const groupId = groupJoinParams?.id;
  const inviteCode = inviteCodeParams?.code;

  useEffect(() => {
    // Determine which route we're on
    if (inviteCode) {
      setIsInviteCodeRoute(true);
      loadGroupFromInvite();
    } else if (groupId) {
      setIsInviteCodeRoute(false);
      loadGroupById();
    }

    async function loadGroupById() {
      try {
        setLoading(true);
        const response = await authFetch(`/api/groups/${groupId}`);
        if (response.ok) {
          const groupData = await response.json();
          setGroup(groupData);
          // Check if user is already a member
          if (groupData.userRole) {
            setJoined(true);
          }
        } else if (response.status === 404) {
          toast({
            title: "Group not found",
            description: "This group doesn't exist or the invite link is invalid",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Failed to load group:", error);
        toast({
          title: "Failed to load group",
          description: "Unable to fetch group details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    async function loadGroupFromInvite() {
      try {
        setLoading(true);
        // For invite codes, we need to validate the code first
        // The backend will return group info if the invite is valid
        setGroup(null); // We'll get group info after accepting invite
      } catch (error) {
        console.error("Failed to process invite:", error);
        toast({
          title: "Invalid invite",
          description: "This invite link is invalid or expired",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  }, [groupId, inviteCode, toast]);

  const handleJoinGroup = async () => {
    if (!groupId && !inviteCode) return;

    setJoining(true);

    try {
      let response;
      
      if (isInviteCodeRoute && inviteCode) {
        // Handle invite code route - call /api/invites/accept
        response = await authFetch("/api/invites/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: inviteCode }),
        });
      } else if (groupId) {
        // Handle public group join route - call /api/groups/:id/members
        response = await authFetch(`/api/groups/${groupId}/members`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
      }

      if (response && response.ok) {
        const result = await response.json();
        setJoined(true);
        
        // For invite codes, we get group info from the result
        if (isInviteCodeRoute && result.membership) {
          // Load group info after successful invite acceptance
          const groupResponse = await authFetch(`/api/groups/${result.groupId}`);
          if (groupResponse.ok) {
            const groupData = await groupResponse.json();
            setGroup(groupData);
          }
        }
        
        toast({
          title: "Welcome to the group!",
          description: `You've successfully joined ${group?.name || 'the group'}`,
        });
        
        // Redirect to the group feed if we have the group ID
        const targetGroupId = result.groupId || groupId;
        if (targetGroupId) {
          setTimeout(() => setLocation(`/groups/${targetGroupId}`), 2000);
        }
      } else {
        const errorData = await response?.json().catch(() => ({}));
        toast({
          title: "Failed to join group",
          description: errorData.message || "Unable to join the group",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to join group:", error);
      toast({
        title: "Failed to join group",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
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

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/groups")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Groups
          </Button>
          <SectionTitle title="Join Group" />
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading group details...</p>
        </div>
      </div>
    );
  }

  // For invite code routes, show join interface even without group details
  if (!group && !isInviteCodeRoute) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/groups")}
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Groups
          </Button>
          <SectionTitle title="Join Group" />
        </div>
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Group Not Found</h3>
          <p className="text-muted-foreground mb-4">
            This group doesn't exist or the invite link is no longer valid.
          </p>
          <Button onClick={() => setLocation("/groups")}>
            Browse Groups
          </Button>
        </Card>
      </div>
    );
  }

  // Handle invite code route without group details
  if (isInviteCodeRoute && !group && !joined) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/groups")}
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Groups
          </Button>
          <SectionTitle title="Join Group" />
        </div>
        <Card className="p-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg mb-4">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">You've been invited to join a group</h3>
            <p className="text-sm text-muted-foreground">
              Click the button below to accept this invitation and join the group.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation("/groups")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinGroup}
              disabled={joining}
              className="flex-1"
              data-testid="join-group-button"
            >
              {joining ? "Joining..." : "Accept Invitation"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/groups")}
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Groups
        </Button>
        <SectionTitle title="Join Group" />
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={group.photoUrl} alt={group.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-xl">
              {getInitials(group.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold truncate">{group.name}</h2>
              <div className="flex items-center gap-1">
                {group.isPublic ? (
                  <Globe className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {group.memberCount || 0} member{group.memberCount !== 1 ? 's' : ''}
              </span>
              <Badge variant="outline">
                {group.isPublic ? "Public Group" : "Private Group"}
              </Badge>
            </div>
            
            {group.description && (
              <p className="text-muted-foreground">
                {group.description}
              </p>
            )}
          </div>
        </div>

        {joined ? (
          <div className="text-center p-6 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
              {isInviteCodeRoute ? "Welcome to the group!" : "You're already in this group!"}
            </h3>
            <p className="text-green-700 dark:text-green-300 mb-4">
              {isInviteCodeRoute 
                ? "You've successfully joined the group. You'll be redirected to the group feed shortly."
                : "Start participating in conversations and sharing your fitness journey."
              }
            </p>
            <Button onClick={() => setLocation(group ? `/groups/${groupId || 'mine'}` : "/groups")}>
              {group ? "Go to Group" : "View All Groups"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">You've been invited to join</h3>
              <p className="text-sm text-muted-foreground">
                {group.isPublic 
                  ? "This is a public group - anyone can join and participate."
                  : "This is a private group - you need an invitation to join."
                }
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/groups")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleJoinGroup}
                disabled={joining}
                className="flex-1"
                data-testid="join-group-button"
              >
                {joining ? "Joining..." : (isInviteCodeRoute ? "Accept Invitation" : "Join Group")}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}