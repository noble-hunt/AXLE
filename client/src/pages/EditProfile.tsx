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
import { Save, KeyRound, Mail } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { apiRequest } from "@/lib/queryClient"
import { supabase } from "@/lib/supabase"

export default function EditProfile() {
  const [, setLocation] = useLocation()
  const { user, profile, setProfile } = useAppStore()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [firstName, setFirstName] = useState(profile?.firstName || '')
  const [lastName, setLastName] = useState(profile?.lastName || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '')
  
  // Password reset state
  const [resetEmail, setResetEmail] = useState(user?.email || '')
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const handleSave = async () => {
    if (!user?.id) return

    setIsSaving(true)
    try {
      const updateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth || null
      }

      // Update via PATCH endpoint that supports all profile fields including avatarUrl
      const result = await apiRequest('POST', '/api/profiles', {
        action: 'update',
        firstName: updateData.firstName,
        lastName: updateData.lastName, 
        dateOfBirth: updateData.dateOfBirth
      })
      const responseData = await result.json()

      if (responseData.profile) {
        // Update local store with response data - PATCH endpoint returns camelCase
        setProfile({
          ...profile,
          userId: user.id,
          firstName: responseData.profile.firstName || responseData.profile.first_name,
          lastName: responseData.profile.lastName || responseData.profile.last_name,
          dateOfBirth: responseData.profile.dateOfBirth || responseData.profile.date_of_birth,
          username: responseData.profile.username || profile?.username,
          avatarUrl: responseData.profile.avatarUrl || responseData.profile.avatar_url || profile?.avatarUrl,
          providers: responseData.profile.providers || profile?.providers || ['email'],
          createdAt: responseData.profile.createdAt || responseData.profile.created_at || profile?.createdAt || new Date()
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

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address to reset your password.",
        variant: "destructive",
      })
      return
    }

    setIsResettingPassword(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      if (error) {
        throw error
      }
      
      toast({
        title: "Password reset sent!",
        description: "Check your email for instructions to reset your password.",
      })
    } catch (error) {
      console.error('Password reset error:', error)
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Failed to send password reset email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsResettingPassword(false)
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

        {/* Password Reset Section */}
        <motion.div variants={slideUp}>
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Password & Security</h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reset your password by entering your email address. You'll receive instructions via email.
              </p>
              
              <div>
                <Label htmlFor="resetEmail" className="text-body font-medium text-foreground">
                  Email Address
                </Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="mt-2"
                  data-testid="input-reset-email"
                />
              </div>
              
              <div className="flex justify-start pt-2">
                <Button 
                  variant="secondary"
                  onClick={handlePasswordReset} 
                  disabled={isResettingPassword || !resetEmail.trim()}
                  className="min-w-[160px]"
                  data-testid="button-reset-password"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {isResettingPassword ? "Sending..." : "Send Reset Email"}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}