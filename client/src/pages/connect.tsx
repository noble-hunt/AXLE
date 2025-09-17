import { useState } from "react"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Smartphone, Watch, Wifi, Users, Share, Settings, Heart, RefreshCw, CheckCircle } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { useToast } from "@/hooks/use-toast"

export default function Connect() {
  const { wearables, connectWearable, disconnectWearable, syncWearableData } = useAppStore()
  const { toast } = useToast()
  const [syncingIds, setSyncingIds] = useState<string[]>([])
  
  // Debug readout
  console.log('Connect Page State:', { 
    totalWearables: wearables.length,
    connectedWearables: wearables.filter(w => w.connected).length,
    wearableTypes: wearables.map(w => ({ name: w.name, type: w.type, connected: w.connected, brand: w.brand }))
  })
  
  // Map wearable brand/name to icon
  const getIcon = (name: string, type: string) => {
    if (name.includes('Apple Health')) return Smartphone
    if (name.includes('Apple Watch')) return Watch
    if (name.includes('Garmin')) return Watch
    if (name.includes('WHOOP')) return Heart
    if (name.includes('Fitbit')) return Heart
    if (name.includes('Oura')) return Heart
    
    // Fallback to type-based icons
    switch (type) {
      case 'smartwatch': return Watch
      case 'fitness_tracker': return Heart
      case 'heart_rate_monitor': return Heart
      case 'smartphone': return Smartphone
      default: return Wifi
    }
  }

  const handleSync = async (wearableId: string, wearableName: string) => {
    setSyncingIds(prev => [...prev, wearableId])
    
    try {
      // Simulate sync delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      syncWearableData(wearableId)
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced data from ${wearableName}`,
      })
    } catch (error) {
      toast({
        title: "Sync Failed", 
        description: "Unable to sync data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSyncingIds(prev => prev.filter(id => id !== wearableId))
    }
  }
  
  const connectedCount = wearables.filter(w => w.connected).length

  return (
    <>
      <SectionTitle title="Connect & Share" />

      {/* Connection Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="connected-services">
          <Wifi className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{connectedCount}</p>
          <p className="text-xs text-muted-foreground">Connected</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="available-services">
          <Share className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{wearables.length}</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </Card>
      </div>

      {/* App Integrations */}
      <div className="space-y-4">
        <SectionTitle title="App Integrations" />
        
        {wearables.map((wearable) => {
          const Icon = getIcon(wearable.name, wearable.type)
          return (
            <Card key={wearable.id} className="p-4 card-shadow border border-border" data-testid={`wearable-${wearable.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <Icon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">{wearable.name}</h4>
                    <p className="text-sm text-muted-foreground">{wearable.brand} • {wearable.type.replace('_', ' ')}</p>
                    {wearable.batteryLevel && (
                      <p className="text-xs text-muted-foreground">Battery: {wearable.batteryLevel}%</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {wearable.connected ? (
                    <>
                      <div className="w-2 h-2 bg-chart-2 rounded-full" />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl" 
                        data-testid={`sync-${wearable.id}`}
                        onClick={() => handleSync(wearable.id, wearable.name)}
                        disabled={syncingIds.includes(wearable.id)}
                      >
                        {syncingIds.includes(wearable.id) ? (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync Now
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl text-chart-2" 
                        data-testid={`disconnect-${wearable.id}`}
                        onClick={() => disconnectWearable(wearable.id)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm" 
                      className="rounded-xl bg-primary text-primary-foreground" 
                      data-testid={`connect-${wearable.id}`}
                      onClick={() => connectWearable(wearable.id)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Privacy Settings */}
      <Card className="p-4 card-shadow border border-border">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Privacy Settings</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Share workout data</p>
              <p className="text-sm text-muted-foreground">Allow connected apps to access workout information</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" data-testid="toggle-workout-sharing">
              Enabled
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Share personal records</p>
              <p className="text-sm text-muted-foreground">Allow sharing of PR achievements</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" data-testid="toggle-pr-sharing">
              Enabled
            </Button>
          </div>
        </div>
      </Card>
    </>
  )
}
