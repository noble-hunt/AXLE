import { useState, useEffect } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Users, Lock, Globe, MessageSquare, Share, Clock } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Group {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
  role: string;
  joinedAt: string;
  memberCount?: number;
  postCount?: number;
  lastActivity?: string;
  unreadCount?: number;
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Load user's groups
  useEffect(() => {
    async function loadGroups() {
      try {
        setLoading(true);
        const response = await authFetch("/api/groups/mine");
        if (response.ok) {
          const groupsData = await response.json();
          // Add mock last activity and unread counts for demo
          const groupsWithActivity = groupsData.map((group: Group) => ({
            ...group,
            lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            unreadCount: Math.floor(Math.random() * 5),
          }));
          setGroups(groupsWithActivity);
        }
      } catch (error) {
        console.error("Failed to load groups:", error);
        toast({
          title: "Failed to load groups",
          description: "Unable to fetch your groups",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, [toast]);

  const handleCreateGroup = () => {
    setLocation("/groups/new");
  };

  const handleSelectGroup = (groupId: string) => {
    setLocation(`/groups/${groupId}`);
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
      <div className="space-y-6">
        <SectionTitle title="Groups" />
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle title="Groups" />
        <Button onClick={handleCreateGroup} data-testid="create-group-button">
          <Plus className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Groups Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first group to start connecting with others.
          </p>
          <Button onClick={handleCreateGroup}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Group
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card 
              key={group.id} 
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleSelectGroup(group.id)}
              data-testid={`group-item-${group.id}`}
            >
              <div className="flex items-center gap-4">
                {/* Group Avatar */}
                <Avatar className="w-12 h-12">
                  <AvatarImage src={group.photoUrl} alt={group.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(group.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Group Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base truncate">{group.name}</h3>
                    <div className="flex items-center gap-1">
                      {group.isPublic ? (
                        <Globe className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {group.role}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {group.memberCount || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {group.postCount || 0}
                    </span>
                    {group.lastActivity && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDistanceToNow(new Date(group.lastActivity), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  
                  {group.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {group.description}
                    </p>
                  )}
                </div>

                {/* Unread Count & Actions */}
                <div className="flex items-center gap-3">
                  {group.unreadCount && group.unreadCount > 0 && (
                    <Badge className="bg-primary text-primary-foreground">
                      {group.unreadCount > 99 ? '99+' : group.unreadCount}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/groups/${group.id}/invite`);
                    }}
                    data-testid={`invite-button-${group.id}`}
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}