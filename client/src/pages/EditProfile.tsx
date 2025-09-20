import { useState } from "react"
import { useLocation } from "wouter"
import { useAppStore } from "@/store/useAppStore"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { useToast } from "@/hooks/use-toast"
import { Save } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { apiRequest } from "@/lib/queryClient"

export default function EditProfile() {
  const [, setLocation] = useLocation()
  const { user, profile, setProfile } = useAppStore()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [firstName, setFirstName] = useState(profile?.firstName || '')
  const [lastName, setLastName] = useState(profile?.lastName || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '')

  const handleSave = async () => {
    if (!user?.id) return

    setIsSaving(true)
    try {
      const updateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth || null
      }

      // Update via API  
      const result = await apiRequest('PATCH', '/api/profiles', updateData)
      const responseData = await result.json()

      if (responseData.profile) {
        // Update local store with response data
        setProfile((prev: any) => prev ? {
          ...prev,
          firstName: responseData.profile.first_name,
          lastName: responseData.profile.last_name,
          dateOfBirth: responseData.profile.date_of_birth,
        } : {
          userId: user.id,
          firstName: responseData.profile.first_name,
          lastName: responseData.profile.last_name,
          dateOfBirth: responseData.profile.date_of_birth,
          username: responseData.profile.username,
          avatarUrl: responseData.profile.avatar_url,
          providers: responseData.profile.providers || ['email'],
          createdAt: new Date(responseData.profile.created_at)
        })

        toast({
          title: "Profile updated!",
          description: "Your profile information has been saved successfully.",
        })

        setLocation("/profile")
      }
    } catch (error) {
      console.error('Profile update error:', error)
      toast({
        title: "Update failed",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const formatDateForInput = (dateString: string | null | undefined) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toISOString().split('T')[0] // YYYY-MM-DD format
    } catch {
      return ''
    }
  }

  return (
    <div className="min-h-screen pb-safe-area-inset-bottom">
      <motion.div 
        className="space-y-6 pb-[calc(theme(spacing.20)+env(safe-area-inset-bottom))]"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <BackButton 
            fallbackPath="/profile"
            variant="ghost"
            size="sm"
            showText={false}
          />
          <h1 className="text-heading font-bold text-foreground">Edit Profile</h1>
        </div>

        {/* Form */}
        <motion.div variants={slideUp}>
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName" className="text-body font-medium text-foreground">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="mt-2"
                  data-testid="input-first-name"
                />
              </div>

              <div>
                <Label htmlFor="lastName" className="text-body font-medium text-foreground">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  className="mt-2"
                  data-testid="input-last-name"
                />
              </div>

              <div>
                <Label htmlFor="dateOfBirth" className="text-body font-medium text-foreground">
                  Date of Birth
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formatDateForInput(dateOfBirth)}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="mt-2"
                  data-testid="input-date-of-birth"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="min-w-[120px]"
                data-testid="button-save-profile"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}