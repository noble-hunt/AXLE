import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface HealthResponse {
  clientEnvPresent: boolean;
  serverEnvPresent: boolean;
  canQuery: boolean;
}

export default function DevEnv() {
  const { data: health, isLoading, error } = useQuery<HealthResponse>({
    queryKey: ["/api/health/supabase"]
  });

  const getUrlHost = () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      if (!url) return "Not configured";
      return new URL(url).host;
    } catch {
      return "Invalid URL";
    }
  };

  const anonKeyPresent = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  const StatusIcon = ({ status }: { status: boolean }) => 
    status ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-dev-env">
            Environment Status
          </h1>
          <p className="text-muted-foreground">
            Development environment configuration status
          </p>
        </div>

        {/* Client Environment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Client Environment (Vite)
              <Badge variant="secondary" data-testid="badge-client">Client</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Supabase URL</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded" data-testid="text-supabase-url">
                  {getUrlHost()}
                </code>
                <StatusIcon status={Boolean(import.meta.env.VITE_SUPABASE_URL)} />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Anonymous Key</span>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={anonKeyPresent ? "default" : "destructive"}
                  data-testid="badge-anon-key"
                >
                  {anonKeyPresent ? "Present" : "Missing"}
                </Badge>
                <StatusIcon status={anonKeyPresent} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Server Health
              <Badge variant="secondary" data-testid="badge-server">Server</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8" data-testid="loading-health">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Checking server health...
                </span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-red-500" data-testid="error-health">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Failed to check server health</span>
              </div>
            ) : health ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Client Environment Variables</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={health.clientEnvPresent ? "default" : "destructive"}
                      data-testid="badge-client-env"
                    >
                      {health.clientEnvPresent ? "Present" : "Missing"}
                    </Badge>
                    <StatusIcon status={health.clientEnvPresent} />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Server Environment Variables</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={health.serverEnvPresent ? "default" : "destructive"}
                      data-testid="badge-server-env"
                    >
                      {health.serverEnvPresent ? "Present" : "Missing"}
                    </Badge>
                    <StatusIcon status={health.serverEnvPresent} />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database Connectivity</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={health.canQuery ? "default" : "destructive"}
                      data-testid="badge-can-query"
                    >
                      {health.canQuery ? "Connected" : "Failed"}
                    </Badge>
                    <StatusIcon status={health.canQuery} />
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}