import { motion } from "framer-motion"
import { fadeIn } from "@/lib/motion-variants"
import { Heart, Activity, Calendar, TrendingUp, Clock, Zap } from "lucide-react"
import { Card } from "@/components/swift/card"
import { StatBadge } from "@/components/swift/stat-badge"

export default function Health() {
  return (
    <motion.div 
      className="space-y-6"
      variants={fadeIn}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-heading font-bold text-foreground">Health</h1>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Heart className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Health Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatBadge
          icon={<Heart className="w-4 h-4" />}
          value="72"
          label="Avg HR"
          data-testid="avg-heart-rate"
        />
        <StatBadge
          icon={<Activity className="w-4 h-4" />}
          value="8,421"
          label="Steps"
          data-testid="daily-steps"
        />
        <StatBadge
          icon={<Clock className="w-4 h-4" />}
          value="7.5h"
          label="Sleep"
          data-testid="sleep-hours"
        />
        <StatBadge
          icon={<Zap className="w-4 h-4" />}
          value="85"
          label="Energy"
          data-testid="energy-score"
        />
      </div>

      {/* Wearables Section */}
      <div className="space-y-4">
        <h2 className="text-subheading font-semibold text-foreground">Connected Devices</h2>
        
        <Card className="p-4" data-testid="wearables-placeholder">
          <div className="text-center space-y-3 py-8">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-body font-semibold text-foreground">Connect Your Devices</h3>
              <p className="text-caption text-muted-foreground">
                Connect wearables to track your health metrics automatically
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Health Reports Section */}
      <div className="space-y-4">
        <h2 className="text-subheading font-semibold text-foreground">Health Reports</h2>
        
        <Card className="p-4" data-testid="reports-placeholder">
          <div className="text-center space-y-3 py-8">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-body font-semibold text-foreground">AI Health Insights</h3>
              <p className="text-caption text-muted-foreground">
                Get personalized health reports based on your activity and metrics
              </p>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  )
}