import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/swift/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Card } from "@/components/swift/card"
import { Bell, Mail, Calendar } from "lucide-react"
import type { Profile } from "@shared/schema"
import { useAppStore } from "@/store/useAppStore"

interface ReportPreferencesSheetProps {
  isOpen: boolean
  onClose: () => void
  currentPreferences: Profile | null
}

const preferencesSchema = z.object({
  reportFrequency: z.enum(['weekly', 'monthly', 'both', 'none']),
  reportWeeklyDay: z.number().min(0).max(6).nullable(),
  reportMonthlyDay: z.number().min(1).max(31).nullable(),
  enableNotifications: z.boolean(),
  enableEmail: z.boolean()
})

type PreferencesFormValues = z.infer<typeof preferencesSchema>

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' }
]

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`
}))

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

export function ReportPreferencesSheet({ isOpen, onClose, currentPreferences }: ReportPreferencesSheetProps) {
  const { toast } = useToast()

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      reportFrequency: currentPreferences?.reportFrequency || 'weekly',
      reportWeeklyDay: currentPreferences?.reportWeeklyDay !== undefined ? currentPreferences.reportWeeklyDay : 1,
      reportMonthlyDay: currentPreferences?.reportMonthlyDay !== undefined ? currentPreferences.reportMonthlyDay : 1,
      enableNotifications: currentPreferences?.enableNotifications ?? true,
      enableEmail: currentPreferences?.enableEmail ?? false
    }
  })

  // Update form when preferences change
  useEffect(() => {
    if (currentPreferences) {
      form.reset({
        reportFrequency: currentPreferences.reportFrequency || 'weekly',
        reportWeeklyDay: currentPreferences.reportWeeklyDay !== undefined ? currentPreferences.reportWeeklyDay : 1,
        reportMonthlyDay: currentPreferences.reportMonthlyDay !== undefined ? currentPreferences.reportMonthlyDay : 1,
        enableNotifications: currentPreferences.enableNotifications ?? true,
        enableEmail: currentPreferences.enableEmail ?? false
      })
    }
  }, [currentPreferences, form])

  const updatePreferences = useMutation({
    mutationFn: async (values: PreferencesFormValues) => {
      const response = await apiRequest('PATCH', '/api/profiles/report-preferences', values)
      
      if (!response.ok) {
        throw new Error('Failed to update report preferences')
      }
      
      return response.json()
    },
    onSuccess: (updatedPreferences) => {
      // Optimistically update React Query cache without triggering refetch
      queryClient.setQueryData(['/api/profiles'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          reportFrequency: updatedPreferences.reportFrequency,
          reportWeeklyDay: updatedPreferences.reportWeeklyDay,
          reportMonthlyDay: updatedPreferences.reportMonthlyDay,
          enableNotifications: updatedPreferences.enableNotifications,
          enableEmail: updatedPreferences.enableEmail
        }
      })
      
      // Also update Zustand store to keep it in sync (avoid hydration cascade)
      useAppStore.setState((state) => ({
        profile: state.profile ? {
          ...state.profile,
          reportFrequency: updatedPreferences.reportFrequency,
          reportWeeklyDay: updatedPreferences.reportWeeklyDay,
          reportMonthlyDay: updatedPreferences.reportMonthlyDay,
          enableNotifications: updatedPreferences.enableNotifications,
          enableEmail: updatedPreferences.enableEmail
        } : state.profile
      }))
      
      toast({
        title: "Preferences saved",
        description: "Your report settings have been updated successfully."
      })
      onClose()
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to save preferences",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again."
      })
    }
  })

  const handleSubmit = (values: PreferencesFormValues) => {
    // Send null for weekly/monthly day fields when those frequencies aren't selected
    const payload = {
      ...values,
      reportWeeklyDay: (values.reportFrequency === 'weekly' || values.reportFrequency === 'both') ? values.reportWeeklyDay : null,
      reportMonthlyDay: (values.reportFrequency === 'monthly' || values.reportFrequency === 'both') ? values.reportMonthlyDay : null,
    }
    updatePreferences.mutate(payload)
  }

  const watchedFrequency = form.watch('reportFrequency')
  const showWeeklySettings = watchedFrequency === 'weekly' || watchedFrequency === 'both'
  const showMonthlySettings = watchedFrequency === 'monthly' || watchedFrequency === 'both'

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] max-w-[400px] mx-auto overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Report Settings</SheetTitle>
          <SheetDescription>
            Configure how often you receive fitness reports and delivery preferences
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
            {/* Report Frequency */}
            <Card className="p-4">
              <FormField
                control={form.control}
                name="reportFrequency"
                render={({ field }) => (
                  <FormItem data-testid="form-item-frequency">
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Report Frequency
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      data-testid="select-frequency"
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-trigger-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly" data-testid="option-weekly">Weekly Reports</SelectItem>
                        <SelectItem value="monthly" data-testid="option-monthly">Monthly Reports</SelectItem>
                        <SelectItem value="both" data-testid="option-both">Weekly & Monthly</SelectItem>
                        <SelectItem value="none" data-testid="option-none">No Automatic Reports</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>

            {/* Weekly Settings */}
            {showWeeklySettings && (
              <Card className="p-4">
                <FormField
                  control={form.control}
                  name="reportWeeklyDay"
                  render={({ field }) => (
                    <FormItem data-testid="form-item-weekly-day">
                      <FormLabel>Weekly Report Day</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                        data-testid="select-weekly-day"
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-trigger-weekly-day">
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WEEKDAYS.map((day) => (
                            <SelectItem 
                              key={day.value} 
                              value={day.value.toString()}
                              data-testid={`option-weekday-${day.value}`}
                            >
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Card>
            )}

            {/* Monthly Settings */}
            {showMonthlySettings && (
              <Card className="p-4">
                <FormField
                  control={form.control}
                  name="reportMonthlyDay"
                  render={({ field }) => (
                    <FormItem data-testid="form-item-monthly-day">
                      <FormLabel>Monthly Report Day</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                        data-testid="select-monthly-day"
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-trigger-monthly-day">
                            <SelectValue placeholder="Select day of month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MONTH_DAYS.map((day) => (
                            <SelectItem 
                              key={day.value} 
                              value={day.value.toString()}
                              data-testid={`option-monthday-${day.value}`}
                            >
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Card>
            )}

            {/* Notification Settings */}
            <Card className="p-4 space-y-4">
              <FormField
                control={form.control}
                name="enableNotifications"
                render={({ field }) => (
                  <FormItem 
                    className="flex items-center justify-between"
                    data-testid="form-item-notifications"
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                      <FormLabel className="mb-0">In-App Notifications</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-notifications"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enableEmail"
                render={({ field }) => (
                  <FormItem 
                    className="flex items-center justify-between"
                    data-testid="form-item-email"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <FormLabel className="mb-0">Email Delivery</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-email"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={updatePreferences.isPending}
                data-testid="button-save"
              >
                {updatePreferences.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
