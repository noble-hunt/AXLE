import { useQuery, useMutation } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { useLocation } from "wouter"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { FileText, Plus, TrendingUp, Calendar, ChevronLeft, Settings } from "lucide-react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { ReportDetailModal } from "@/components/reports/ReportDetailModal"
import { ReportPreferencesSheet } from "@/components/reports/ReportPreferencesSheet"
import { useAppStore } from "@/store/useAppStore"
import type { Report } from "@shared/schema"

export default function ReportsPage() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const profile = useAppStore(state => state.profile)

  // Fetch user reports with aggressive caching for instant loads
  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: ['/api/reports'],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    placeholderData: (previousData) => previousData, // Keep previous data during refetch to prevent skeleton flicker
  })

  // Generate report mutation
  const generateReport = useMutation({
    mutationFn: async (frequency: 'weekly' | 'monthly') => {
      const response = await apiRequest('POST', '/api/reports/generate', { frequency })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate report' }))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] })
      toast({
        title: "Report generated",
        description: "Your new report is ready to view"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate report",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleGenerateReport = () => {
    // For now, default to weekly. TODO: Add frequency selector
    generateReport.mutate('weekly')
  }

  // Mark report as viewed mutation with optimistic update (no refetch!)
  const markAsViewed = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await apiRequest('PATCH', `/api/reports/${reportId}/viewed`, {})
      
      if (!response.ok) {
        throw new Error('Failed to mark report as viewed')
      }
      
      return response.json()
    },
    onSuccess: (_, reportId) => {
      // Optimistically update cache without refetching
      queryClient.setQueryData<Report[]>(['/api/reports'], (old) => {
        if (!old) return old
        return old.map(report => 
          report.id === reportId 
            ? { ...report, viewedAt: new Date().toISOString() } 
            : report
        )
      })
    }
  })

  const handleReportViewed = useCallback((reportId: string) => {
    markAsViewed.mutate(reportId)
  }, [markAsViewed])

  // Delete report mutation with optimistic update
  const deleteReport = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await apiRequest('DELETE', `/api/reports/${reportId}`, {})
      
      if (!response.ok) {
        throw new Error('Failed to delete report')
      }
      
      return reportId
    },
    onSuccess: (reportId) => {
      // Optimistically remove from cache
      queryClient.setQueryData<Report[]>(['/api/reports'], (old) => {
        if (!old) return old
        return old.filter(report => report.id !== reportId)
      })
      toast({
        title: "Report deleted",
        description: "The report has been permanently removed"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete report",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleDeleteReport = useCallback((reportId: string) => {
    deleteReport.mutate(reportId)
  }, [deleteReport])

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-sm mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/profile")}
                data-testid="button-back"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-title font-bold text-foreground">Reports</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreferencesOpen(true)}
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* CTA Card for first-time users */}
        {(!reports || reports.length === 0) && !isLoading && (
          <motion.div {...fadeIn}>
            <Card className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-heading font-bold text-foreground mb-2">
                Welcome to AXLE Reports
              </h2>
              <p className="text-body text-muted-foreground mb-6">
                Get comprehensive insights into your fitness journey with weekly and monthly reports featuring workout analytics, PR progression, and personalized recommendations.
              </p>
              <Button
                onClick={() => setPreferencesOpen(true)}
                className="w-full"
                data-testid="button-setup-reports"
              >
                <Plus className="w-4 h-4 mr-2" />
                Set Up Reports
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Loading State - minimal to prevent flicker */}
        {isLoading && !reports && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-caption text-muted-foreground">Loading reports...</p>
            </div>
          </div>
        )}

        {/* Reports List */}
        {reports && reports.length > 0 && (
          <motion.div {...slideUp} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-subheading font-semibold text-foreground">
                Your Reports
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateReport}
                disabled={generateReport.isPending}
                data-testid="button-generate-report"
              >
                <Plus className="w-4 h-4 mr-2" />
                {generateReport.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>

            {reports.map((report: any, index: number) => {
              const isViewed = !!report.viewedAt
              const periodStart = new Date(report.timeframeStart)
              const periodEnd = new Date(report.timeframeEnd)

              return (
                <motion.div
                  key={report.id}
                  {...slideUp}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => setSelectedReport(report)}
                    data-testid={`report-card-${report.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-body font-semibold text-foreground">
                            {report.frequency === 'weekly' ? 'Weekly' : 'Monthly'} Report
                          </h3>
                          <div className="flex items-center gap-2 text-caption text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!isViewed && (
                        <div className="w-2 h-2 rounded-full bg-primary" data-testid="badge-unviewed" />
                      )}
                    </div>

                    {/* Quick Stats Preview */}
                    {report.metrics && (
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
                        <div>
                          <p className="text-caption text-muted-foreground">Workouts</p>
                          <p className="text-body font-semibold text-foreground">
                            {report.metrics.workoutStats?.totalWorkouts || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">PRs</p>
                          <p className="text-body font-semibold text-foreground">
                            {report.metrics.prStats?.totalPRs || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-muted-foreground">Score</p>
                          <p className="text-body font-semibold text-foreground">
                            {report.metrics.workoutStats?.consistencyScore || 0}%
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Empty State after initial setup */}
        {reports && reports.length === 0 && !isLoading && (
          <Card className="p-8 text-center">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-body text-muted-foreground">
              No reports generated yet. Check back soon!
            </p>
          </Card>
        )}
      </div>

      {/* Report Detail Modal */}
      <ReportDetailModal
        report={selectedReport}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        onReportViewed={handleReportViewed}
        onDelete={handleDeleteReport}
      />

      {/* Report Preferences Sheet */}
      <ReportPreferencesSheet
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        currentPreferences={profile}
      />
    </div>
  )
}
