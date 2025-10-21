import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { fadeIn } from "@/lib/motion-variants"
import { Heart, Activity, Calendar, TrendingUp, Clock, Zap, Brain, BatteryLow, Link, RefreshCw } from "lucide-react"
import { Card } from "@/components/swift/card"
import { StatBadge } from "@/components/swift/stat-badge"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/useAppStore"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import MetricCard from "@/components/health/MetricCard"

export default function Health() {
  const { 
    reports, 
    connections,
    fetchReports,
    fetchConnections,
    getRecentReports,
    getLatestReport,
    loadHealthCharts
  } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Load health data on mount
  useEffect(() => {
    const loadHealthData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          fetchReports(),
          fetchConnections(),
          loadHealthCharts()
        ])
      } catch (error) {
        console.error('Failed to load health data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadHealthData()
  }, [fetchReports, fetchConnections, loadHealthCharts])
  
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        fetchReports(),
        fetchConnections(),
        loadHealthCharts()
      ])
    } catch (error) {
      console.error('Failed to refresh health data:', error)
    } finally {
      setRefreshing(false)
    }
  }
  
  const latestReport = getLatestReport()
  const recentReports = getRecentReports(14)
  const connectedProviders = connections.filter((conn: any) => conn.connected)
  const hasData = reports.length > 0
  
  // Prepare chart data for last 14 days
  const chartData = recentReports.map((report, index) => ({
    date: new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day: new Date(report.date).getDate(),
    hrv: report.metrics?.recovery?.hrv || null,
    restingHR: report.metrics?.heartRate?.resting || null,
    sleepScore: report.metrics?.sleep?.quality === 'excellent' ? 100 : 
                   report.metrics?.sleep?.quality === 'good' ? 80 :
                   report.metrics?.sleep?.quality === 'fair' ? 60 : 
                   report.metrics?.sleep?.quality === 'poor' ? 40 : null,
    stress: null, // Stress data comes from sync parameters, not stored metrics
    fatigue: (report as any).fatigueScore ? Math.round((report as any).fatigueScore * 100) : null, // Convert 0-1 to 0-100 scale
  })).reverse() // Show chronologically
  
  // Get today's metrics from latest report
  const todayMetrics = latestReport ? {
    hrv: latestReport.metrics?.recovery?.hrv || null,
    restingHR: latestReport.metrics?.heartRate?.resting || null,
    sleepScore: latestReport.metrics?.sleep?.quality === 'excellent' ? 100 : 
                latestReport.metrics?.sleep?.quality === 'good' ? 80 :
                latestReport.metrics?.sleep?.quality === 'fair' ? 60 : 
                latestReport.metrics?.sleep?.quality === 'poor' ? 40 : null,
    stress: null, // Stress data comes from sync parameters, not stored metrics
    fatigue: (latestReport as any).fatigueScore ? Math.round((latestReport as any).fatigueScore * 100) : null, // Convert 0-1 to 0-100 scale
  } : null

  if (loading) {
    return (
      <motion.div 
        className="space-y-6"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-heading font-bold text-foreground">Health Analytics</h1>
        </div>
        <div className="text-center py-8">
          <Activity className="w-8 h-8 animate-pulse text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading health data...</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={fadeIn}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-heading font-bold text-foreground">Health Analytics</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            data-testid="button-refresh-health"
            className="w-10 h-10 rounded-2xl"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Today's Metrics */}
          <div className="px-4 sm:px-5 md:px-6 mt-4">
            <div className="text-white/90 text-lg font-semibold mb-2">Today's Metrics</div>

            {/* Row 1: Proprietary */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard 
                keyName="axle_health_score" 
                title="AXLE Health Score" 
                description="Your all-in score combining vitality, performance, circadian alignment and energy-system balance." 
                colorClass="text-sky-400" 
                icon={<Zap className="w-5 h-5" />}
              />
              <MetricCard 
                keyName="vitality_score" 
                title="Vitality" 
                description="Daily well-being from sleep quality, activity, recovery and training intensity." 
                colorClass="text-emerald-400" 
                icon={<Heart className="w-5 h-5" />}
              />
              <MetricCard 
                keyName="performance_potential" 
                title="Performance Potential" 
                description="Readiness to push harder today, driven by recovery, intensity tolerance and resting HR." 
                colorClass="text-indigo-400" 
                icon={<TrendingUp className="w-5 h-5" />}
              />
              <MetricCard 
                keyName="circadian_alignment" 
                title="Circadian Alignment" 
                description="How well your behaviors align with daylight: activity in sunlight, steady sleep, and small boosts from UV while avoiding high pollution." 
                colorClass="text-amber-400" 
                icon={<Calendar className="w-5 h-5" />}
              />
              <MetricCard 
                keyName="energy_systems_balance" 
                title="Energy Systems" 
                description="How balanced your training is across alactic, lactic and aerobic energy systems over the last month." 
                colorClass="text-pink-400" 
                icon={<Brain className="w-5 h-5" />}
              />
            </div>

            {/* Row 2: Provider core metrics */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <MetricCard 
                keyName="hrv" 
                title="HRV" 
                unit=" ms" 
                description="Higher HRV generally means better recovery. Track trends over time, not single days." 
                colorClass="text-cyan-400" 
                icon={<Activity className="w-5 h-5" />}
              />
              <MetricCard 
                keyName="resting_hr" 
                title="Resting HR" 
                unit=" bpm" 
                description="Lower resting heart rate often indicates improved aerobic fitness and recovery." 
                colorClass="text-rose-400" 
                icon={<Heart className="w-5 h-5" />}
              />
              <MetricCard 
                keyName="sleep_score" 
                title="Sleep Score" 
                unit="" 
                description="Overall sleep quality from your provider. Aim for consistency plus 7–9 hours nightly." 
                colorClass="text-purple-400" 
                icon={<Clock className="w-5 h-5" />}
              />
              <MetricCard 
                keyName="fatigue_score" 
                title="Fatigue Score" 
                unit="" 
                description="AXLE's fatigue estimate from training load, sleep and recovery signals." 
                colorClass="text-orange-400" 
                icon={<BatteryLow className="w-5 h-5" />}
              />
            </div>
          </div>

          {/* 14-Day Charts */}
          <div className="space-y-6">
            <h2 className="text-subheading font-semibold text-foreground">14-Day Trends</h2>
            
            {/* HRV Chart */}
            <Card className="p-4" data-testid="hrv-chart">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Heart Rate Variability (HRV)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      domain={['dataMin - 5', 'dataMax + 5']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="hrv" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Resting Heart Rate Chart */}
            <Card className="p-4" data-testid="resting-hr-chart">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                Resting Heart Rate
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      domain={['dataMin - 5', 'dataMax + 5']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="restingHR" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Sleep Score Chart */}
            <Card className="p-4" data-testid="sleep-score-chart">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Sleep Score
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sleepScore" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Fatigue Score Chart */}
            <Card className="p-4" data-testid="fatigue-chart">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <BatteryLow className="w-4 h-4 text-amber-500" />
                Fatigue Score
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="fatigue" 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="space-y-6">
          <Card className="p-8 text-center" data-testid="empty-state">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Connect a device to see health insights</h3>
            <p className="text-muted-foreground mb-6">
              Start tracking your health metrics by connecting a wearable device or health app.
            </p>
            <Button asChild data-testid="connect-device-button">
              <a href="/connect">
                <Link className="w-4 h-4 mr-2" />
                Connect Device
              </a>
            </Button>
          </Card>
        </div>
      )}

      {/* Connected Devices Status */}
      {connectedProviders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-subheading font-semibold text-foreground">Connected Devices</h2>
          
          <div className="grid gap-3">
            {connectedProviders.map((connection: any) => {
              const lastSync = connection.lastSync ? new Date(connection.lastSync) : null
              
              return (
                <Card key={connection.provider} className="p-4 flex items-center justify-between" data-testid={`connected-${connection.provider}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div>
                      <p className="font-medium text-foreground">{connection.provider}</p>
                      {lastSync && (
                        <p className="text-xs text-muted-foreground">
                          Last sync: {lastSync.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${connection.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} rounded-full`} />
                    <span className="text-xs text-muted-foreground capitalize">
                      {connection.status}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}