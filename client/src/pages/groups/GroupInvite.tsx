import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Copy, Share, QrCode, Check, Users, Lock, Globe } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

interface Group {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  isPublic: boolean;
  memberCount?: number;
  role: string;
}

interface Invite {
  id: string;
  code: string;
  groupId: string;
  createdBy: string;
  invitedEmail?: string;
  createdAt: string;
  expiresAt?: string;
}

export default function GroupInvite() {
  const [, params] = useRoute("/groups/:id/invite");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<Invite | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const groupId = params?.id;
  
  // Different invite URLs for public vs private groups
  const inviteUrl = group?.isPublic 
    ? `${window.location.origin}/groups/join/${groupId}`
    : currentInvite 
      ? `${window.location.origin}/join/${currentInvite.code}`
      : '';

  useEffect(() => {
    if (!groupId) return;

    async function loadGroup() {
      try {
        setLoading(true);
        const response = await authFetch(`/api/groups/${groupId}`);
        if (response.ok) {
          const groupData = await response.json();
          setGroup(groupData);
          
          // For private groups, create/get an invite code
          if (!groupData.isPublic) {
            await createOrGetInvite();
          } else {
            // For public groups, generate QR code immediately
            await generateQRCode(`${window.location.origin}/groups/join/${groupId}`);
          }
        } else if (response.status === 404) {
          toast({
            title: "Group not found",
            description: "This group doesn't exist or you don't have access to it",
            variant: "destructive",
          });
          setLocation("/groups");
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

    async function createOrGetInvite() {
      try {
        setCreatingInvite(true);
        const response = await authFetch(`/api/invites/${groupId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (response.ok) {
          const invite = await response.json();
          setCurrentInvite(invite);
          
          // Generate QR code with invite code URL
          const inviteCodeUrl = `${window.location.origin}/join/${invite.code}`;
          await generateQRCode(inviteCodeUrl);
        }
      } catch (error) {
        console.error("Failed to create invite:", error);
        toast({
          title: "Failed to create invite",
          description: "Unable to generate invite link",
          variant: "destructive",
        });
      } finally {
        setCreatingInvite(false);
      }
    }

    async function generateQRCode(url: string) {
      try {
        const canvas = canvasRef.current;
        if (canvas) {
          await QRCode.toCanvas(canvas, url, {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
        }
      } catch (qrError) {
        console.error("Failed to generate QR code:", qrError);
      }
    }

    loadGroup();
  }, [groupId, toast, setLocation]);

  const handleCopyLink = async () => {
    if (!inviteUrl) {
      toast({
        title: "No invite link",
        description: "Invite link not ready yet",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Invite link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast({
        title: "Failed to copy",
        description: "Unable to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Join ${group?.name} on AXLE`,
      text: `You're invited to join "${group?.name}" fitness group!`,
      url: inviteUrl,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // User cancelled or error occurred
        console.log("Share cancelled or failed:", error);
      }
    } else {
      // Fallback to copy
      handleCopyLink();
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
          <SectionTitle title="Invite to Group" />
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading group details...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return null;
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
        <SectionTitle title="Invite to Group" />
      </div>

      {/* Group Info */}
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-16 h-16">
            <AvatarImage src={group.photoUrl} alt={group.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-lg">
              {getInitials(group.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold truncate">{group.name}</h2>
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
                {group.memberCount || 0} member{group.memberCount !== 1 ? 's' : ''}
              </span>
            </div>
            
            {group.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {group.description}
              </p>
            )}
          </div>
        </div>

        {/* QR Code */}
        <div className="text-center mb-6">
          <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
            <canvas
              ref={canvasRef}
              className="mx-auto"
              data-testid="qr-code-canvas"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <QrCode className="w-4 h-4" />
            Scan to join the group
          </p>
        </div>

        {/* Refer a Friend */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Refer a Friend</label>
            <Badge variant="outline">
              {group.isPublic ? "Public Group" : "Private Group"}
            </Badge>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-lg mb-3">
            <p className="text-sm text-muted-foreground">
              {group.isPublic 
                ? "Invite friends to join your fitness group. Anyone can join public groups directly."
                : "Share this invite link with friends. Each person who joins through your link will be recorded as your referral."
              }
            </p>
          </div>
          
          {inviteUrl ? (
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all">
                {inviteUrl}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                data-testid="copy-link-button"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4 bg-muted rounded-md">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
              <span className="text-sm text-muted-foreground">Generating invite link...</span>
            </div>
          )}
        </div>

        {/* Share Actions */}
        {inviteUrl && (
          <div className="flex gap-3 pt-6">
            <Button
              onClick={handleShare}
              className="flex-1"
              data-testid="share-button"
            >
              <Share className="w-4 h-4 mr-2" />
              Share Invite
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        )}

        {/* Privacy Info */}
        <div className="mt-6 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            {group.isPublic 
              ? "Anyone with this link can join your public group immediately."
              : "Only people you invite with this link can join your private group."
            }
          </p>
        </div>
      </Card>
    </div>
  );
}