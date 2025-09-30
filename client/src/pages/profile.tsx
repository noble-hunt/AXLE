import { useLocation } from "wouter"
import { useRef, useState, useEffect } from "react"
import { useAppStore } from "@/store/useAppStore"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  requestPushPermissions, 
  registerPushToken, 
  scheduleDailyWorkoutReminder, 
  cancelAllLocalNotifications,
  isNativeEnvironment 
} from "@/lib/nativeNotifications"
import { 
  requestWebPushPermissions,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  isWebPushSupported
} from "@/lib/webpush"
import { enableNotificationTopic, sendTestPushNotification } from '@/lib/pushNotifications'
import { isNative, isWeb, getPlatform, logEnvironment } from "@/lib/env"
import { authFetch } from "@/lib/authFetch"
import { 
  User, 
  Trophy,
  Dumbbell,
  Calendar,
  Weight,
  Bell,
  Shield,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  Settings,
  Award,
  Camera,
  FileText
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// Health connections component
function HealthConnections() {
  const [, setLocation] = useLocation()
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-subheading font-semibold text-foreground">Health Connections</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          data-testid="manage-connections"
          onClick={() => setLocation("/connect")}
        >
          <span className="text-primary">Manage</span>
        </Button>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <div>
              <p className="text-body font-medium text-foreground">Apple Watch</p>
              <p className="text-caption text-muted-foreground">Connected</p>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-success"></div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <div>
              <p className="text-body font-medium text-foreground">iPhone Health</p>
              <p className="text-caption text-muted-foreground">Connected</p>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-success"></div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-400 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <div>
              <p className="text-body font-medium text-foreground">Fitbit</p>
              <p className="text-caption text-muted-foreground">Not connected</p>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-muted"></div>
        </div>
      </div>
    </Card>
  )
}

// Your Stats component
function YourStats() {
  const { workouts, prs } = useAppStore()
  
  // Calculate stats
  const totalWorkouts = workouts.length
  const totalPRs = prs.length
  const activeDays = 123 // This could be calculated from workout dates
  const totalVolume = "12.5K" // This could be calculated from workout data
  
  return (
    <div>
      <h3 className="text-subheading font-semibold text-foreground mb-4">Your Stats</h3>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center" data-testid="stat-card-workouts">
          <Dumbbell className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-heading font-bold text-foreground">{totalWorkouts}</p>
          <p className="text-caption text-muted-foreground">Total Workouts</p>
        </Card>
        
        <Card className="p-4 text-center" data-testid="stat-card-prs">
          <Trophy className="w-6 h-6 text-accent mx-auto mb-2" />
          <p className="text-heading font-bold text-foreground">{totalPRs}</p>
          <p className="text-caption text-muted-foreground">Personal Records</p>
        </Card>
        
        <Card className="p-4 text-center" data-testid="stat-card-active-days">
          <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-heading font-bold text-foreground">{activeDays}</p>
          <p className="text-caption text-muted-foreground">Active Days</p>
        </Card>
        
        <Card className="p-4 text-center" data-testid="stat-card-volume">
          <Weight className="w-6 h-6 text-secondary mx-auto mb-2" />
          <p className="text-heading font-bold text-foreground">{totalVolume} lbs</p>
          <p className="text-caption text-muted-foreground">Total Volume</p>
        </Card>
      </div>
    </div>
  )
}

// Modal content components
function NotificationModal() {
  const { toast } = useToast()
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [dailyReminderTime, setDailyReminderTime] = useState("09:00")
  const [isLoading, setIsLoading] = useState(false)
  const platform = getPlatform()
  
  // Log environment on component mount for debugging
  useState(() => {
    logEnvironment()
  })

  // Save notification preferences to server
  const saveNotificationPreferences = async (enabled: boolean, reminderTime: string, platform: string) => {
    try {
      const response = await authFetch('/api/notification-prefs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          dailyReminders: enabled,
          reminderTime,
          platform,
        }),
      })

      if (!response.ok) {
        console.error('Failed to save notification preferences')
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error)
    }
  }

  // Register device token with backend
  const registerDeviceToken = async (token: string) => {
    try {
      const response = await authFetch('/api/push/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          platform: isNative ? 'ios' : 'web' 
        })
      })
      
      if (response.ok) {
        console.log('Device token registered successfully')
      } else {
        throw new Error('Failed to register device token')
      }
    } catch (error) {
      console.error('Error registering device token:', error)
      throw error
    }
  }

  const handleNotificationToggle = async (enabled: boolean) => {
    setIsLoading(true)
    
    try {
      if (enabled) {
        if (isNative) {
          // Native path: Use APNs and local notifications
          const hasPermissions = await requestPushPermissions()
          if (!hasPermissions) {
            toast({
              title: "Permission denied",
              description: "Please enable notifications in your device settings.",
              variant: "destructive",
            })
            setIsLoading(false)
            return
          }

          // Register for APNs push notifications
          await registerPushToken(registerDeviceToken)
          
          // Schedule local daily reminder if time is set
          if (dailyReminderTime) {
            const [hours, minutes] = dailyReminderTime.split(':').map(Number)
            await scheduleDailyWorkoutReminder(hours, minutes)
          }
          
          toast({
            title: "Notifications enabled",
            description: "You'll receive workout reminders and updates via APNs.",
          })
        } else {
          // Web path: Use Web Push
          if (!isWebPushSupported()) {
            toast({
              title: "Not supported",
              description: "Web Push notifications are not supported in this browser.",
              variant: "destructive",
            })
            setIsLoading(false)
            return
          }

          const hasPermissions = await requestWebPushPermissions()
          if (!hasPermissions) {
            toast({
              title: "Permission denied", 
              description: "Please enable notifications in your browser settings.",
              variant: "destructive",
            })
            setIsLoading(false)
            return
          }

          // Get VAPID public key and subscribe to web push
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
          if (!vapidKey) {
            toast({
              title: "Configuration error",
              description: "Web Push is not properly configured.",
              variant: "destructive",
            })
            setIsLoading(false)
            return
          }

          const subscription = await subscribeToWebPush(vapidKey)
          if (!subscription) {
            toast({
              title: "Subscription failed",
              description: "Failed to subscribe to web push notifications.",
              variant: "destructive",
            })
            setIsLoading(false)
            return
          }
          
          toast({
            title: "Notifications enabled",
            description: "You'll receive workout reminders via Web Push.",
          })
        }
        
        // Save preferences to server for both paths
        await saveNotificationPreferences(enabled, dailyReminderTime, platform)
        
        // Enable weekly-report topic by default on first enable
        await enableNotificationTopic('weekly-report', true)
        
        setNotificationsEnabled(true)
      } else {
        // Disable notifications for both paths
        if (isNative) {
          await cancelAllLocalNotifications()
        } else {
          await unsubscribeFromWebPush()
        }
        
        await saveNotificationPreferences(false, dailyReminderTime, platform)
        setNotificationsEnabled(false)
        toast({
          title: "Notifications disabled",
          description: "You won't receive workout reminders.",
        })
      }
    } catch (error) {
      console.error('Error handling notification toggle:', error)
      toast({
        title: "Error",
        description: "Failed to update notification settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTimeChange = async (time: string) => {
    setDailyReminderTime(time)
    
    if (notificationsEnabled && time) {
      const [hours, minutes] = time.split(':').map(Number)
      await scheduleDailyWorkoutReminder(hours, minutes)
      toast({
        title: "Reminder updated",
        description: `Daily workout reminder set for ${time}`,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-subheading font-semibold text-foreground mb-2">Notification Settings</h3>
        <p className="text-caption text-muted-foreground">
          Manage your workout reminders and push notifications.
        </p>
      </div>

      {/* Enable Notifications Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="notifications-toggle" className="text-body font-medium text-foreground">
            Enable Notifications
          </Label>
          <p className="text-caption text-muted-foreground">
            Receive workout reminders and updates
          </p>
        </div>
        <Switch
          id="notifications-toggle"
          checked={notificationsEnabled}
          onCheckedChange={handleNotificationToggle}
          disabled={isLoading}
          data-testid="switch-notifications"
        />
      </div>

      {/* Daily Reminder Time */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="reminder-time" className="text-body font-medium text-foreground">
            Daily Workout Reminder
          </Label>
          <p className="text-caption text-muted-foreground">
            Set a time for your daily workout reminder
          </p>
        </div>
        <input
          id="reminder-time"
          type="time"
          value={dailyReminderTime}
          onChange={(e) => handleTimeChange(e.target.value)}
          disabled={!notificationsEnabled || isLoading}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="input-reminder-time"
        />
      </div>

      {/* Platform-specific information */}
      <div className="rounded-lg bg-muted p-4">
        <p className="text-caption text-muted-foreground">
          {isNative ? (
            <>✅ Running in native app - APNs and local notifications available</>
          ) : (
            <>🌐 Running in web browser - Web Push notifications available</>
          )}
        </p>
      </div>

      {/* Test and Unregister buttons */}
      {notificationsEnabled && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={async () => {
                setIsLoading(true)
                try {
                  const success = await sendTestPushNotification()
                  if (success) {
                    toast({
                      title: "Test sent",
                      description: "Check for a test notification!",
                    })
                  } else {
                    toast({
                      title: "Test failed",
                      description: "Failed to send test notification.",
                      variant: "destructive",
                    })
                  }
                } catch (error) {
                  console.error('Error sending test notification:', error)
                  toast({
                    title: "Error",
                    description: "Failed to send test notification.",
                    variant: "destructive",
                  })
                } finally {
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
              data-testid="button-test-notification"
            >
              Send Test
            </Button>
            
            <Button
              variant="secondary"
              onClick={async () => {
                setIsLoading(true)
                try {
                  if (isNative) {
                    // For native, we need to handle unregistering device token
                    await cancelAllLocalNotifications()
                  } else {
                    await unsubscribeFromWebPush()
                  }
                  
                  await saveNotificationPreferences(false, dailyReminderTime, platform)
                  setNotificationsEnabled(false)
                  
                  toast({
                    title: "Unregistered",
                    description: "Push notifications have been disabled and unregistered.",
                  })
                } catch (error) {
                  console.error('Error unregistering notifications:', error)
                  toast({
                    title: "Error",
                    description: "Failed to unregister notifications.",
                    variant: "destructive",
                  })
                } finally {
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
              data-testid="button-unregister-notification"
            >
              Unregister
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AboutModal() {
  return (
    <div className="space-y-4">
      <p className="text-body text-foreground leading-relaxed">
        AXLE health & performance is a wholistic fitness application. Generated workouts based on adjustable variables that learn about you & get better with you everyday. Connect your wearable device and use our proprietary metrics system to gain better insight and understanding into your health journey. Log and track personal records of lifts, cardio / aerobic work, gymnastics, and more. Join groups with your friends, broadcast workouts, complete them together. Unlock achievements, and more.
      </p>
    </div>
  )
}

function PrivacyModal() {
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-3">
        <h3 className="text-subheading font-semibold text-foreground">Axle Privacy Policy</h3>
        <p className="text-caption text-muted-foreground">Effective Date: [Insert Date] • Governing Law: Delaware, U.S.A.</p>
        
        <div className="space-y-4 text-body text-foreground">
          <div>
            <h4 className="font-semibold mb-2">1. Information We Collect</h4>
            <p>We collect:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name, email, date of birth</li>
              <li>Biometric data common on wearables (e.g., heart rate, sleep, HRV)</li>
              <li>Workout history and training data</li>
              <li>Geolocation data</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">2. How We Collect Data</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>From you directly (account creation, input)</li>
              <li>Automatically via device sensors and wearables</li>
              <li>Through third-party integrations (Wodify, payment processors)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. How We Use Data</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and personalize workouts</li>
              <li>Improve Platform performance</li>
              <li>Maintain security and prevent fraud</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">4. Data Sharing</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Shared with third-party service providers (payment processors, analytics tools)</li>
              <li>Never sold to advertisers</li>
              <li>May be disclosed if legally required</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">5. Data Storage & Security</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Stored on U.S. servers</li>
              <li>Protected with multi-layer encryption</li>
              <li>Access limited to authorized personnel</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">6. User Rights</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Export: You may export your data at any time</li>
              <li>Delete: You may delete your data from your account. Axle retains backups as required for security and compliance</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">7. Data Retention</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Data retained until account deletion</li>
              <li>Backups maintained as necessary</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">8. Children</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Axle does not permit users under 18</li>
              <li>We do not knowingly collect children's data</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">9. HIPAA</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Axle is not a HIPAA-regulated entity</li>
              <li>Health data is handled responsibly but outside HIPAA scope</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">10. Changes</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>We may update this Policy at any time</li>
              <li>Updates will be posted here with a new effective date</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function TermsModal() {
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-3">
        <h3 className="text-subheading font-semibold text-foreground">Axle Terms & Conditions</h3>
        <p className="text-caption text-muted-foreground">Effective Date: [Insert Date] • Governing Law: State of Delaware, U.S.A.</p>
        
        <div className="space-y-4 text-body text-foreground">
          <div>
            <h4 className="font-semibold mb-2">1. Acceptance of Terms</h4>
            <p>By creating an account or using Axle ("the Platform"), you agree to these Terms & Conditions. If you do not agree, do not use the Platform. Users must be 18+ and located in the U.S.</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">2. User Accounts</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate information (name, email, date of birth)</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials</li>
              <li>Axle reserves the right to suspend or terminate accounts for misuse</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. User Conduct</h4>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Misuse workouts, scrape data, or share paid content without authorization</li>
              <li>Upload unlawful, abusive, or harmful content</li>
              <li>Reverse engineer, tamper with, or exploit the Platform</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">4. Intellectual Property</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>All workouts, programs, data visualizations, and content are owned by Axle</li>
              <li>Users are granted a limited, non-transferable license to use the Platform</li>
              <li>Any data uploaded (e.g., workouts, wearables) grants Axle a license to use it for Platform functionality</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">5. Payments & Subscriptions</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Axle charges subscription fees for access</li>
              <li>Payments are non-refundable</li>
              <li>Cancellation is permitted anytime before the next billing date</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">6. Health Disclaimer</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Axle is not a medical provider</li>
              <li>All fitness programming carries inherent risks</li>
              <li>Consult your doctor before beginning any program</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">7. Liability Limitation</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Axle is not liable for injuries, damages, or data loss</li>
              <li>Axle does not guarantee uninterrupted or error-free service</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">8. Termination</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Axle may suspend or terminate accounts for violations of these Terms</li>
              <li>Users may delete their account at any time</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">9. Modifications</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Axle may update these Terms at any time</li>
              <li>Continued use of the Platform constitutes acceptance of new Terms</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">10. Governing Law & Disputes</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>These Terms are governed by Delaware law</li>
              <li>Disputes will be resolved exclusively in Delaware courts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function HelpSupportModal() {
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-3">
        <h3 className="text-subheading font-semibold text-foreground">Axle Help & Support Policy</h3>
        <p className="text-caption text-muted-foreground">Effective Date: [Insert Date] • Governing Law: Delaware, U.S.A.</p>
        
        <div className="space-y-4 text-body text-foreground">
          <div>
            <h4 className="font-semibold mb-2">1. Contacting Support</h4>
            <p>Axle provides customer support through the Help & Support tab, FAQ resources, and email at support@axleapp.com. Support requests are handled during business hours and Axle will make reasonable efforts to respond within 48 hours.</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">2. Scope of Support</h4>
            <p>Axle's support services are limited to Platform functionality and general fitness guidance. Support representatives are not licensed medical providers and cannot provide medical advice.</p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. Emergency Disclaimer</h4>
            <p>Axle does not provide emergency or medical services. If you are experiencing a medical emergency, please call 911 immediately.</p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">4. Communications & Privacy</h4>
            <p>When you contact Axle through the Help & Support tab, we collect and store your communications (e.g., support emails, chat transcripts). This information is used solely to address your request and improve customer service. Support communications are subject to the Axle Privacy Policy.</p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">5. Liability</h4>
            <p>Axle is not liable for injuries, damages, or losses related to the use of workouts, fitness programming, or reliance on information provided by support staff. All fitness activities carry inherent risks, and users voluntarily assume these risks by using the Platform.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Settings section component
function SettingsSection() {
  const [, setLocation] = useLocation()
  const { clearAuth } = useAppStore()
  const { toast } = useToast()
  
  const handleSignOut = async () => {
    try {
      console.log('Sign out clicked - starting sign out process')
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Sign out error:', error)
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      clearAuth()
      toast({
        title: "Signed out",
        description: "You've been signed out successfully.",
      })
      console.log('Sign out successful, redirecting to login')
      setLocation("/auth/login")
    } catch (error) {
      console.error('Unexpected sign out error:', error)
      toast({
        title: "Sign out failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }
  
  const settingsItems = [
    { icon: Settings, label: "Edit Profile", path: "/profile/edit", color: "text-primary", type: "navigate" },
    { icon: Trophy, label: "Personal Records", path: "/prs", color: "text-accent", type: "navigate" },
    { icon: Award, label: "Achievements", path: "/achievements", color: "text-accent", type: "navigate" },
    { icon: Bell, label: "Notifications", type: "modal" },
    { icon: Shield, label: "Privacy", type: "modal" },
    { icon: Info, label: "About", type: "modal" },
    { icon: FileText, label: "Terms of Use", type: "modal" },
    { icon: HelpCircle, label: "Help & Support", type: "modal" },
  ]
  
  const getModalContent = (label: string) => {
    switch (label) {
      case "Notifications":
        return <NotificationModal />
      case "About":
        return <AboutModal />
      case "Privacy":
        return <PrivacyModal />
      case "Terms of Use":
        return <TermsModal />
      case "Help & Support":
        return <HelpSupportModal />
      default:
        return null
    }
  }

  return (
    <div>
      <h3 className="text-subheading font-semibold text-foreground mb-4">Settings</h3>
      <Card className="divide-y divide-border">
        {settingsItems.map((item, index) => {
          if (item.type === "modal") {
            return (
              <Dialog key={index}>
                <DialogTrigger asChild>
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    data-testid={`settings-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-5 h-5 ${item.color || 'text-muted-foreground'}`} />
                      <span className="text-body font-medium text-foreground">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{item.label}</DialogTitle>
                  </DialogHeader>
                  {getModalContent(item.label)}
                </DialogContent>
              </Dialog>
            )
          } else {
            return (
              <button
                key={index}
                onClick={() => setLocation(item.path!)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                data-testid={`settings-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${item.color || 'text-muted-foreground'}`} />
                  <span className="text-body font-medium text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )
          }
        })}
        
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
          data-testid="settings-sign-out"
        >
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="text-body font-medium text-destructive">Sign Out</span>
        </button>
      </Card>
    </div>
  )
}

export default function Profile() {
  const { user, profile, setProfile } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const { toast } = useToast()
  
  // Get user info with fallbacks
  const firstName = profile?.firstName || user?.user_metadata?.first_name || ''
  const lastName = profile?.lastName || user?.user_metadata?.last_name || ''
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : (profile?.username || user?.email?.split('@')[0] || 'Athlete')
  const userEmail = user?.email || 'athlete@axlapp.com'
  const avatarUrl = profile?.avatarUrl
  const memberSince = profile?.createdAt || user?.created_at || new Date('2021-08-20')
  
  // Format member since date
  const formatMemberSince = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      if (isNaN(dateObj.getTime())) {
        return 'Jan 1, 2024' // Fallback for invalid dates
      }
      return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }).format(dateObj)
    } catch (error) {
      return 'Jan 1, 2024' // Fallback for any errors
    }
  }

  // Photo editing handlers
  const handleEditPhoto = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      })
      return
    }

    setIsUploadingPhoto(true)

    try {
      // Convert to base64 for now (could be replaced with Supabase storage later)
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64String = e.target?.result as string
        
        // Update profile with new avatar (safely handle null profile)
        setProfile((prev: any) => prev ? { 
          ...prev, 
          avatarUrl: base64String 
        } : { 
          avatarUrl: base64String,
          userId: user?.id || '',
          firstName: user?.user_metadata?.first_name || '',
          lastName: user?.user_metadata?.last_name || '',
          providers: ['email'],
          username: user?.email?.split('@')[0] || '',
          createdAt: new Date()
        })
        
        // Also update in database if user is authenticated
        if (user?.id) {
          try {
            const { supabase } = await import('@/lib/supabase')
            await supabase
              .from('profiles')
              .update({ avatar_url: base64String })
              .eq('user_id', user.id)
          } catch (error) {
            console.error('Failed to update avatar in database:', error)
          }
        }

        toast({
          title: "Profile photo updated!",
          description: "Your new profile photo has been saved.",
        })
      }
      
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Photo upload error:', error)
      toast({
        title: "Upload failed",
        description: "Failed to update your profile photo. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingPhoto(false)
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
        <div className="text-center">
          <h1 className="text-heading font-bold text-foreground">Profile</h1>
        </div>

        {/* User Info Section */}
        <motion.div className="text-center space-y-4" variants={slideUp}>
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={handleEditPhoto}
              disabled={isUploadingPhoto}
              className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background hover:bg-primary/90 transition-colors disabled:opacity-50"
              data-testid="button-edit-photo"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              ref={fileInputRef}
              data-testid="input-photo-upload"
            />
          </div>
          
          <div>
            <h2 className="text-subheading font-bold text-foreground">{fullName}</h2>
            <p className="text-body text-muted-foreground">{userEmail}</p>
            <p className="text-caption text-muted-foreground mt-1">
              Member since {formatMemberSince(memberSince)}
            </p>
          </div>
        </motion.div>

        {/* Health Connections */}
        <motion.div variants={slideUp}>
          <HealthConnections />
        </motion.div>

        {/* Your Stats */}
        <motion.div variants={slideUp}>
          <YourStats />
        </motion.div>

        {/* Settings */}
        <motion.div variants={slideUp}>
          <SettingsSection />
        </motion.div>
      </motion.div>
    </div>
  )
}