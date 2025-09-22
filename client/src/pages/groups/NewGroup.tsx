import { useState } from "react";
import { useLocation } from "wouter";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Globe, Lock, Upload } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function NewGroup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: false,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setPhotoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a name for your group",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // For now, we'll create the group without photo upload
      // In a real app, you'd upload the photo first and get a URL
      const response = await authFetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isPublic: formData.isPublic,
          // photoUrl: would be set after upload
        }),
      });

      if (response.ok) {
        const newGroup = await response.json();
        toast({
          title: "Group created",
          description: `Successfully created ${newGroup.name}`,
        });
        setLocation("/groups");
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Failed to create group",
          description: errorData.message || "An error occurred while creating the group",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create group:", error);
      toast({
        title: "Failed to create group",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
        <SectionTitle title="Create New Group" />
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Upload */}
          <div className="space-y-3">
            <Label>Group Photo</Label>
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={photoPreview || undefined} alt="Group photo" />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {formData.name ? getInitials(formData.name) : <Camera className="w-8 h-8" />}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-2">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="sr-only"
                    id="photo-upload"
                    data-testid="photo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional. JPG, PNG up to 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              placeholder="Enter group name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              maxLength={100}
              data-testid="group-name-input"
            />
            <p className="text-xs text-muted-foreground">
              {formData.name.length}/100 characters
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what your group is about..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              maxLength={500}
              rows={3}
              data-testid="group-description-input"
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Privacy Setting */}
          <div className="space-y-3">
            <Label>Privacy</Label>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {formData.isPublic ? (
                  <Globe className="w-5 h-5 text-primary" />
                ) : (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {formData.isPublic ? "Public Group" : "Private Group"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formData.isPublic 
                      ? "Anyone can discover and join this group"
                      : "Only invited members can join"
                    }
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
                data-testid="privacy-toggle"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/groups")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="flex-1"
              data-testid="create-group-submit"
            >
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Preview Card */}
      {formData.name && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Preview:</p>
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={photoPreview || undefined} alt={formData.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(formData.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base truncate">{formData.name}</h3>
                <div className="flex items-center gap-1">
                  {formData.isPublic ? (
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {formData.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {formData.description}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}