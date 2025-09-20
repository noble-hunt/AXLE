import { useState, useEffect } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Lock, Globe } from "lucide-react";
import { GroupFeed } from "@/components/groups/GroupFeed";
import { GroupPostComposer } from "@/components/groups/GroupPostComposer";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
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
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load user's groups
  useEffect(() => {
    async function loadGroups() {
      try {
        setLoading(true);
        const response = await authFetch("/api/groups/mine");
        if (response.ok) {
          const groupsData = await response.json();
          setGroups(groupsData);
          
          // Auto-select first group for demo
          if (groupsData.length > 0 && !selectedGroup) {
            const firstGroup = groupsData[0];
            // Get detailed group info
            const detailResponse = await authFetch(`/api/groups/${firstGroup.id}`);
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              setSelectedGroup({ ...firstGroup, ...detailData });
            }
          }
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
  }, [selectedGroup, toast]);

  const handleCreateGroup = async () => {
    try {
      const response = await authFetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Demo Group ${Date.now()}`,
          description: "A test group for real-time functionality",
          isPublic: false,
        }),
      });

      if (response.ok) {
        const newGroup = await response.json();
        setGroups(prev => [{ ...newGroup, role: 'owner', joinedAt: newGroup.createdAt }, ...prev]);
        
        toast({
          title: "Group created",
          description: `Created group: ${newGroup.name}`,
        });
      }
    } catch (error) {
      console.error("Failed to create group:", error);
      toast({
        title: "Failed to create group",
        description: "Unable to create group",
        variant: "destructive",
      });
    }
  };

  const handleSelectGroup = async (group: Group) => {
    try {
      // Get detailed group info
      const response = await authFetch(`/api/groups/${group.id}`);
      if (response.ok) {
        const detailData = await response.json();
        setSelectedGroup({ ...group, ...detailData });
      }
    } catch (error) {
      console.error("Failed to load group details:", error);
      setSelectedGroup(group);
    }
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
    <div className="space-y-6 h-screen flex flex-col">
      <div className="flex items-center justify-between">
        <SectionTitle title="Groups - Real-time Demo" />
        <Button onClick={handleCreateGroup} data-testid="create-group-button">
          <Plus className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Groups sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Your Groups</h3>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No groups yet. Create one to get started!
              </p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer border transition-colors",
                      selectedGroup?.id === group.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    )}
                    data-testid={`group-item-${group.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {group.isPublic ? (
                            <Globe className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {group.role}
                          </Badge>
                          {group.memberCount && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {group.memberCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {group.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Group feed */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {selectedGroup ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Group header */}
              <Card className="p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {selectedGroup.isPublic ? (
                      <Globe className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    )}
                    <h2 className="text-lg font-semibold">{selectedGroup.name}</h2>
                  </div>
                  <Badge variant="outline">
                    {selectedGroup.role}
                  </Badge>
                </div>
                {selectedGroup.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedGroup.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {selectedGroup.memberCount || 0} member{selectedGroup.memberCount !== 1 ? 's' : ''}
                  </span>
                  <span>
                    {selectedGroup.postCount || 0} post{selectedGroup.postCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </Card>

              {/* Feed container with composer */}
              <div className="flex flex-col flex-1 min-h-0 gap-4">
                {/* Post composer */}
                <GroupPostComposer
                  groupId={selectedGroup.id}
                  onPostCreated={() => {
                    // Refresh could happen here, but real-time updates should handle it
                    console.log("Post created - real-time should update feed");
                  }}
                />

                {/* Feed */}
                <GroupFeed
                  groupId={selectedGroup.id}
                  className="flex-1 min-h-0"
                />
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Group</h3>
              <p className="text-muted-foreground">
                Choose a group from the sidebar to view its feed and start chatting with members.
              </p>
              {groups.length === 0 && (
                <div className="mt-4">
                  <Button onClick={handleCreateGroup} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Group
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}