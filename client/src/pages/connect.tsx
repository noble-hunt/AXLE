import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Smartphone, Watch, Wifi, Users, Share, Settings } from "lucide-react"

const integrations = [
  {
    id: '1',
    name: 'Apple Health',
    icon: Smartphone,
    connected: true,
    description: 'Sync workouts and health data'
  },
  {
    id: '2',
    name: 'Apple Watch',
    icon: Watch,
    connected: true,
    description: 'Track workouts and heart rate'
  },
  {
    id: '3',
    name: 'Strava',
    icon: Wifi,
    connected: false,
    description: 'Share your fitness activities'
  },
  {
    id: '4',
    name: 'MyFitnessPal',
    icon: Users,
    connected: false,
    description: 'Sync nutrition and calorie data'
  }
]

export default function Connect() {
  const connectedCount = integrations.filter(i => i.connected).length

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
          <p className="text-lg font-bold text-foreground">{integrations.length}</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </Card>
      </div>

      {/* App Integrations */}
      <div className="space-y-4">
        <SectionTitle title="App Integrations" />
        
        {integrations.map((integration) => {
          const Icon = integration.icon
          return (
            <Card key={integration.id} className="p-4 card-shadow border border-border" data-testid={`integration-${integration.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <Icon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">{integration.name}</h4>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {integration.connected ? (
                    <>
                      <div className="w-2 h-2 bg-chart-2 rounded-full" />
                      <Button variant="outline" size="sm" className="rounded-xl" data-testid={`disconnect-${integration.id}`}>
                        Connected
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="rounded-xl bg-primary text-primary-foreground" data-testid={`connect-${integration.id}`}>
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
