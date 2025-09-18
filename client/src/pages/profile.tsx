import { useLocation } from "wouter"
import { useAppStore } from "@/store/useAppStore"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
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
  Award
} from "lucide-react"

// Health connections component
function HealthConnections() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-subheading font-semibold text-foreground">Health Connections</h3>
        <Button variant="ghost" size="sm" data-testid="manage-connections">
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

// Settings section component
function SettingsSection() {
  const [, setLocation] = useLocation()
  
  const settingsItems = [
    { icon: Award, label: "Achievements", path: "/achievements", color: "text-accent" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: Shield, label: "Privacy", path: "/privacy" },
    { icon: HelpCircle, label: "Help & Support", path: "/support" },
    { icon: Info, label: "About", path: "/about" },
  ]
  
  return (
    <div>
      <h3 className="text-subheading font-semibold text-foreground mb-4">Settings</h3>
      <Card className="divide-y divide-border">
        {settingsItems.map((item, index) => (
          <button
            key={index}
            onClick={() => setLocation(item.path)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            data-testid={`settings-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-center gap-3">
              <item.icon className={`w-5 h-5 ${item.color || 'text-muted-foreground'}`} />
              <span className="text-body font-medium text-foreground">{item.label}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
        
        <button
          onClick={() => {
            // Handle sign out logic here
            console.log('Sign out clicked')
          }}
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
  const { user, profile } = useAppStore()
  
  // Get user info with fallbacks
  const displayName = profile?.username || user?.email?.split('@')[0] || 'Athlete'
  const userEmail = user?.email || 'athlete@axlapp.com'
  const avatarUrl = profile?.avatar_url
  const memberSince = profile?.created_at || user?.created_at || new Date('2021-08-20')
  
  // Format member since date
  const formatMemberSince = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(new Date(date))
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
          <div className="w-24 h-24 mx-auto rounded-full bg-primary flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          <div>
            <h2 className="text-subheading font-bold text-foreground">{displayName}</h2>
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