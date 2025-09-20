import { useState, useEffect } from "react"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Smartphone, Watch, Wifi, Users, Share, Settings, Heart, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { useToast } from "@/hooks/use-toast"

export default function Connect() {
  const { 
    providers, 
    connections, 
    loadingProviders, 
    loadingConnections,
    fetchProviders, 
    fetchConnections, 
    connectProvider, 
    disconnectProvider,
    syncProviderNow 
  } = useAppStore()
  const { toast } = useToast()
  const [syncingProviders, setSyncingProviders] = useState<string[]>([])
  const [devMode, setDevMode] = useState(false)
  const [mockStress, setMockStress] = useState(5)
  const [mockSleep, setMockSleep] = useState(75)
  
  // Load providers and connections on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchProviders()
        await fetchConnections()
      } catch (error) {
        console.error('Failed to load provider data:', error)
      }
    }
    loadData()
  }, [fetchProviders, fetchConnections])
  
  // Map provider ID to icon and display info
  const getProviderInfo = (providerId: string) => {
    const providerMap: Record<string, { icon: any, displayName: string, description: string }> = {
      'Apple Health': { 
        icon: Smartphone, 
        displayName: 'Apple Health', 
        description: 'iOS Health App integration' 
      },
      'Garmin': { 
        icon: Watch, 
        displayName: 'Garmin Connect', 
        description: 'Garmin wearable devices' 
      },
      'WHOOP': { 
        icon: Heart, 
        displayName: 'WHOOP 4.0', 
        description: 'WHOOP fitness tracker' 
      },
      'Fitbit': { 
        icon: Heart, 
        displayName: 'Fitbit', 
        description: 'Fitbit wearable devices' 
      },
      'Oura': { 
        icon: Heart, 
        displayName: 'Oura Ring', 
        description: 'Oura ring health tracker' 
      },
      'Mock': { 
        icon: Settings, 
        displayName: 'Mock Provider', 
        description: 'Development testing provider' 
      },
    }
    
    return providerMap[providerId] || { 
      icon: Wifi, 
      displayName: providerId, 
      description: 'Health data provider' 
    }
  }

  const getConnectionForProvider = (providerId: string) => {
    return connections.find((conn: any) => conn.provider === providerId)
  }

  const getStatusInfo = (connection: any) => {
    if (!connection) {
      return { status: 'disconnected', color: 'bg-gray-500', text: 'Disconnected' }
    }
    
    if (connection.connected) {
      return { status: 'connected', color: 'bg-green-500', text: 'Connected' }
    }
    
    if (connection.error) {
      return { status: 'error', color: 'bg-red-500', text: 'Error' }
    }
    
    return { status: 'pending', color: 'bg-yellow-500', text: 'Pending' }
  }

  const handleConnect = async (providerId: string) => {
    try {
      await connectProvider(providerId)
      toast({
        title: "Connection Started",
        description: `Connecting to ${getProviderInfo(providerId).displayName}...`,
      })
    } catch (error) {
      toast({
        title: "Connection Failed", 
        description: "Unable to connect. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDisconnect = async (providerId: string) => {
    try {
      await disconnectProvider(providerId)
      toast({
        title: "Disconnected",
        description: `Disconnected from ${getProviderInfo(providerId).displayName}`,
      })
    } catch (error) {
      toast({
        title: "Disconnect Failed", 
        description: "Unable to disconnect. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSync = async (providerId: string) => {
    setSyncingProviders(prev => [...prev, providerId])
    
    try {
      const params = providerId === 'Mock' && devMode ? {
        stress: mockStress,
        sleep: mockSleep
      } : undefined
      
      await syncProviderNow(providerId, params)
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced data from ${getProviderInfo(providerId).displayName}`,
      })
    } catch (error) {
      toast({
        title: "Sync Failed", 
        description: "Unable to sync data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSyncingProviders(prev => prev.filter(id => id !== providerId))
    }
  }
  
  const connectedCount = connections.filter((conn: any) => conn.connected).length
  const availableCount = providers.length

  if (loadingProviders) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Connect Health Providers" />
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading health providers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Connect Health Providers" />

      {/* Connection Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="connected-services">
          <Wifi className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{connectedCount}</p>
          <p className="text-xs text-muted-foreground">Connected</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="available-services">
          <Share className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{availableCount}</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </Card>
      </div>

      {/* Dev Mode Toggle (only show if Mock provider exists) */}
      {providers.some((p: any) => p.id === 'Mock') && (
        <Card className="p-4 card-shadow border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Development Mode</h3>
            </div>
            <Switch 
              checked={devMode} 
              onCheckedChange={setDevMode}
              data-testid="dev-mode-toggle"
            />
          </div>
          
          {devMode && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Simulate health metrics for Mock provider:</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stress Level (1-10)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={mockStress}
                      onChange={(e) => setMockStress(Number(e.target.value))}
                      className="flex-1"
                      data-testid="stress-slider"
                    />
                    <Badge variant="outline" className="w-8 h-6 text-xs justify-center">
                      {mockStress}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sleep Score (0-100)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={mockSleep}
                      onChange={(e) => setMockSleep(Number(e.target.value))}
                      className="flex-1"
                      data-testid="sleep-slider"
                    />
                    <Badge variant="outline" className="w-10 h-6 text-xs justify-center">
                      {mockSleep}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Health Providers Grid */}
      <div className="space-y-4">
        <SectionTitle title="Health Providers" />
        
        {providers.map((provider: any) => {
          const providerInfo = getProviderInfo(provider.id)
          const connection = getConnectionForProvider(provider.id)
          const statusInfo = getStatusInfo(connection)
          const Icon = providerInfo.icon
          const isConnected = connection?.connected
          const isConfigured = provider.hasConfig
          const lastSync = connection?.lastSync ? new Date(connection.lastSync) : null
          
          return (
            <Card key={provider.id} className="p-4 card-shadow border border-border" data-testid={`provider-${provider.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center relative">
                    <Icon className="w-6 h-6 text-muted-foreground" />
                    <div 
                      className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusInfo.color} rounded-full border-2 border-background`}
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{providerInfo.displayName}</h4>
                      {!isConfigured && provider.id !== 'Mock' && (
                        <Badge variant="secondary" className="text-xs">
                          Not Configured
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{providerInfo.description}</p>
                    {lastSync && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Last sync: {lastSync.toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                    {connection?.error && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-destructive" />
                        <p className="text-xs text-destructive">{connection.error}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={statusInfo.status === 'connected' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {statusInfo.text}
                  </Badge>
                  
                  {isConnected ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl" 
                        data-testid={`sync-${provider.id}`}
                        onClick={() => handleSync(provider.id)}
                        disabled={syncingProviders.includes(provider.id)}
                      >
                        {syncingProviders.includes(provider.id) ? (
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
                        className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10" 
                        data-testid={`disconnect-${provider.id}`}
                        onClick={() => handleDisconnect(provider.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm" 
                      className="rounded-xl bg-primary text-primary-foreground" 
                      data-testid={`connect-${provider.id}`}
                      onClick={() => handleConnect(provider.id)}
                      disabled={!isConfigured && provider.id !== 'Mock'}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
        
        {providers.length === 0 && (
          <Card className="p-8 text-center" data-testid="no-providers">
            <Wifi className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Providers Available</h3>
            <p className="text-muted-foreground">Health providers will appear here when configured.</p>
          </Card>
        )}
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
              <p className="font-medium text-foreground">Share health data</p>
              <p className="text-sm text-muted-foreground">Allow connected providers to access health information</p>
            </div>
            <Switch defaultChecked data-testid="toggle-health-sharing" />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Data retention</p>
              <p className="text-sm text-muted-foreground">Keep health data for analysis and insights</p>
            </div>
            <Switch defaultChecked data-testid="toggle-data-retention" />
          </div>
        </div>
      </Card>
    </div>
  )
}