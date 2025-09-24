import { useState, useEffect } from "react"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Smartphone, Watch, Wifi, Users, Share, Settings, Heart, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import { ProviderCard } from '@/components/health/ProviderCard'

type ProviderInfo = { 
  id: string; 
  supported: boolean;
  connected: boolean;
  last_sync: string | null;
  status: string;
  error: string | null;
};

type AllProviderInfo = {
  id: string;
  name: string;
  description: string;
  icon: any;
  supported: boolean;
  connected: boolean;
  last_sync: string | null;
  status: string;
  error: string | null;
};

export default function Connect() {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [devMode, setDevMode] = useState(false)
  const [mockStress, setMockStress] = useState(5)
  const [mockSleep, setMockSleep] = useState(75)
  const { toast } = useToast()
  const { fetchReports, syncProviderNow } = useAppStore()
  
  // Load providers and connections on mount
  useEffect(() => {
    loadProviders()
  }, [])

  async function loadProviders() {
    setLoading(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch('/api/connect/providers', {
        headers: { Authorization: `Bearer ${token ?? ''}` }
      })
      const data = await r.json()
      setProviders(data || [])
    } catch (error) {
      console.error('Failed to load providers:', error)
      toast({
        title: "Load Failed",
        description: "Unable to load health providers",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }
  
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
    return providers.find(p => p.id === providerId)
  }

  const getStatusInfo = (provider: ProviderInfo) => {
    if (!provider?.supported) {
      return { status: 'unavailable', color: 'bg-gray-500', text: 'Unavailable', icon: AlertCircle }
    }
    
    if (provider.connected) {
      return { status: 'connected', color: 'bg-green-500', text: 'Connected', icon: CheckCircle }
    }
    
    if (provider.error) {
      return { status: 'error', color: 'bg-red-500', text: 'Error', icon: AlertCircle }
    }
    
    return { status: 'disconnected', color: 'bg-gray-400', text: 'Disconnected', icon: Clock }
  }

  function toStatus(provider?: ProviderInfo | AllProviderInfo): 'connected' | 'disconnected' | 'error' | 'unavailable' {
    if (!provider) return 'disconnected'
    if (!provider.supported) return 'unavailable'
    if (provider.connected) return 'connected'
    if (provider.error) return 'error'
    return 'disconnected'
  }

  // Create connections by ID lookup
  const connectionsById = Object.fromEntries(
    providers.map(p => [p.id, p])
  )

  const handleConnect = async (providerId: string) => {
    setBusy(providerId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch(`/api/connect/${providerId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` }
      })
      const { redirectUrl, error, connected } = await r.json()
      if (error) throw new Error(error)
      
      if (redirectUrl) {
        window.location.href = redirectUrl // go to OAuth
      } else if (connected) {
        // Mock provider connected instantly
        await loadProviders() // Refresh the list
        toast({
          title: "Connected",
          description: `Successfully connected to ${getProviderInfo(providerId).displayName}`,
        })
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Unable to connect to provider",
        variant: "destructive",
      })
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnect = async (providerId: string) => {
    setBusy(providerId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch(`/api/connect/${providerId}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` }
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'disconnect failed')
      
      await loadProviders() // Refresh the list
      toast({
        title: "Disconnected",
        description: `Successfully disconnected from ${getProviderInfo(providerId).displayName}`,
      })
    } catch (error: any) {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Unable to disconnect provider",
        variant: "destructive",
      })
    } finally {
      setBusy(null)
    }
  }

  const handleSync = async (providerId: string) => {
    setBusy('sync:' + providerId)
    
    try {
      const params = providerId === 'Mock' && devMode ? {
        stress: mockStress,
        sleep: mockSleep
      } : undefined
      
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch('/api/health/sync', {
        method: 'POST',
        headers: { 
          'content-type': 'application/json', 
          Authorization: `Bearer ${token ?? ''}` 
        },
        body: JSON.stringify({ provider: providerId, ...params })
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'sync failed')
      
      await loadProviders() // Refresh to update last sync time
      await fetchReports() // Refresh health dashboard data
      toast({
        title: "Sync Complete",
        description: `Successfully synced data from ${getProviderInfo(providerId).displayName}`,
      })
    } catch (error: any) {
      toast({
        title: "Sync Failed", 
        description: error.message || "Unable to sync data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(null)
    }
  }
  
  // Define all possible providers with their metadata
  const allProviders = [
    { id: 'Mock', name: 'Mock Provider', description: 'Development testing provider', icon: Settings },
    { id: 'Fitbit', name: 'Fitbit', description: 'Fitbit wearable devices', icon: Heart },
    { id: 'Whoop', name: 'WHOOP 4.0', description: 'WHOOP fitness tracker', icon: Heart },
    { id: 'Oura', name: 'Oura Ring', description: 'Oura ring health tracker', icon: Heart },
    { id: 'Garmin', name: 'Garmin Connect', description: 'Garmin wearable devices', icon: Watch },
  ];

  // Merge with actual provider data
  const enrichedProviders = allProviders.map(providerMeta => {
    const providerData = providers.find(p => p.id === providerMeta.id);
    return {
      ...providerMeta,
      supported: providerData?.supported || false,
      connected: providerData?.connected || false,
      last_sync: providerData?.last_sync || null,
      status: providerData?.status || 'disconnected',
      error: providerData?.error || null,
    };
  });

  const availableProviders = enrichedProviders.filter(p => p.supported)
  const connectedCount = enrichedProviders.filter(p => p.connected).length
  const availableCount = availableProviders.length
  const unavailableCount = enrichedProviders.filter(p => !p.supported).length

  if (loading) {
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
      {(providers || []).some((p: any) => p.id === 'Mock') && (
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
        
        <div className="mx-auto max-w-[720px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrichedProviders.map((provider: AllProviderInfo) => {
              const isUnavailable = !provider.supported
              return (
                <div key={provider.id} className="relative">
                <ProviderCard
                  id={provider.id}
                  title={provider.name}
                  subtitle={provider.description}
                  status={isUnavailable ? 'unavailable' : toStatus(provider)}
                  lastSync={provider.last_sync ? new Date(provider.last_sync).toLocaleTimeString() : null}
                  busy={busy === provider.id || busy === 'sync:'+provider.id}
                  disabled={isUnavailable}
                  onConnect={isUnavailable ? undefined : async () => {
                    setBusy(provider.id)
                    try {
                      const token = (await supabase.auth.getSession()).data.session?.access_token
                      const r = await fetch(`/api/connect/${provider.id}/start`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token ?? ''}` }
                      })
                      const { redirectUrl, error, connected } = await r.json()
                      if (error) throw new Error(error)
                      
                      if (redirectUrl) {
                        window.location.href = redirectUrl
                      } else if (connected) {
                        await loadProviders()
                        await fetchReports()
                        toast({
                          title: "Connected",
                          description: `Successfully connected to ${provider.name}`,
                        })
                      }
                    } catch (e: any) { 
                      toast({
                        title: "Connection Failed",
                        description: e.message,
                        variant: "destructive",
                      })
                    }
                    finally { setBusy(null) }
                  }}
                  onSync={isUnavailable ? undefined : async () => {
                    setBusy('sync:'+provider.id)
                    try {
                      const params = provider.id === 'Mock' && devMode ? {
                        stress: mockStress,
                        sleep: mockSleep
                      } : undefined
                      
                      await syncProviderNow(provider.id, params)
                      await loadProviders()
                      toast({
                        title: "Sync Complete",
                        description: `Successfully synced data from ${provider.name}`,
                      })
                    } catch (e: any) { 
                      toast({
                        title: "Sync Failed", 
                        description: e.message || "Unable to sync data. Please try again.",
                        variant: "destructive",
                      })
                    }
                    finally { setBusy(null) }
                  }}
                  onDisconnect={isUnavailable ? undefined : async () => {
                    setBusy(provider.id)
                    try {
                      const token = (await supabase.auth.getSession()).data.session?.access_token
                      const r = await fetch(`/api/connect/${provider.id}/disconnect`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token ?? ''}` }
                      })
                      const j = await r.json()
                      if (!r.ok) throw new Error(j?.error || 'disconnect failed')
                      
                      await loadProviders()
                      toast({
                        title: "Disconnected",
                        description: `Successfully disconnected from ${provider.name}`,
                      })
                    } catch (e: any) { 
                      toast({
                        title: "Disconnect Failed",
                        description: e.message,
                        variant: "destructive",
                      })
                    }
                    finally { setBusy(null) }
                  }}
                />
                {isUnavailable && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="text-xs">
                      Unavailable
                    </Badge>
                  </div>
                )}
              </div>
            )
            })}
          </div>
        </div>
        
        {enrichedProviders.length === 0 && (
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