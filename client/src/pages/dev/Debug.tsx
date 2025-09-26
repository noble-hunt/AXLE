import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { httpJSON } from "@/lib/http";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Loader2, Database, User as UserIcon, Zap, Mail, Sparkles, RotateCcw } from "lucide-react";

interface DebugSessionData {
  userId: string;
  email: string;
}

interface DebugWorkoutsData {
  count: number;
  last5Ids: string[];
}

interface EmailProviderData {
  adminConnectivity: boolean;
  emailConfirm: boolean;
  passwordless: boolean;
  environment: string;
  timestamp: string;
  supabaseUrl: string;
  customSmtpConfigured: boolean;
  userCount: number;
  error?: string;
  details?: string;
}

interface SuggestionDebugData {
  userId: string;
  date: string;
  inputs: {
    workouts: any[];
    health: any;
    prs: any[];
  };
  suggestion?: any;
  error?: string;
}

export default function Debug() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [sessionDebug, setSessionDebug] = useState<DebugSessionData | null>(null);
  const [workoutsDebug, setWorkoutsDebug] = useState<DebugWorkoutsData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailProviderData | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [suggestionDebug, setSuggestionDebug] = useState<SuggestionDebugData | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    // Get current Supabase session
    const getSession = async () => {
      console.log('Debug: Getting Supabase session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Debug: Session data:', session?.user?.id, session?.user?.email);
      console.log('Debug: Session error:', error);
      setUser(session?.user || null);
    };
    
    getSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Debug: Auth state change:', event, session?.user?.id);
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSessionDebug = async () => {
    setIsLoadingSession(true);
    try {
      const response = await authFetch("/api/debug/session");
      if (response.ok) {
        const data = await response.json();
        setSessionDebug(data);
        toast({
          title: "Session debug loaded",
          description: `User ID: ${data.userId}`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Session debug failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setSessionDebug(null);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const fetchWorkoutsDebug = async () => {
    setIsLoadingWorkouts(true);
    try {
      const response = await authFetch("/api/debug/workouts");
      if (response.ok) {
        const data = await response.json();
        setWorkoutsDebug(data);
        toast({
          title: "Workouts debug loaded",
          description: `Found ${data.count} workouts`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Workouts debug failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setWorkoutsDebug(null);
    } finally {
      setIsLoadingWorkouts(false);
    }
  };

  const pingGenerateWorkout = async () => {
    setIsGenerating(true);
    try {
      const response = await authFetch("/api/generate-workout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: "Powerlifting",
          duration: 30,
          intensity: 7
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Workout generated successfully",
          description: `Created: ${data.name} (ID: ${data.id})`,
        });
        // Refresh workouts debug data
        fetchWorkoutsDebug();
      } else {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Generate workout failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchEmailStatus = async () => {
    setIsLoadingEmail(true);
    try {
      const response = await httpJSON("/dev/debug/email");
      if (response.ok) {
        const data = await response.json();
        setEmailStatus(data);
        toast({
          title: "Email status loaded",
          description: data.customSmtpConfigured ? "Custom SMTP configured" : "Default SMTP",
        });
      } else {
        const error = await response.json();
        setEmailStatus({
          adminConnectivity: false,
          emailConfirm: false,
          passwordless: false,
          environment: "unknown",
          timestamp: new Date().toISOString(),
          supabaseUrl: "error",
          customSmtpConfigured: false,
          userCount: 0,
          error: error.message || `HTTP ${response.status}`,
          details: error.details
        });
        throw new Error(error.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Email status failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const fetchSuggestionDebug = async () => {
    setIsLoadingSuggestion(true);
    try {
      const response = await authFetch("/api/suggestions/debug");
      if (response.ok) {
        const data = await response.json();
        setSuggestionDebug(data);
        toast({
          title: "Suggestion debug loaded",
          description: `Found algorithm inputs for ${data.userId}`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Suggestion debug failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setSuggestionDebug(null);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const recomputeSuggestion = async () => {
    setIsRegenerating(true);
    try {
      const response = await authFetch("/api/suggestions/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ regenerate: true }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Suggestion recomputed",
          description: `Generated new suggestion: ${data.suggestion?.request?.category}`,
        });
        // Refresh debug data
        fetchSuggestionDebug();
      } else {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Recompute failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Debug Panel</h1>
        <Badge variant="secondary">Development</Badge>
      </div>

      {/* Supabase Session Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Current Supabase Session
          </CardTitle>
          <CardDescription>
            Information from the current Supabase auth session
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500 text-white">Authenticated</Badge>
              </div>
              <div className="grid gap-2 font-mono text-sm">
                <div><strong>User ID:</strong> {user.id}</div>
                <div><strong>Email:</strong> {user.email}</div>
                <div><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Session Loading</Badge>
                <span className="text-sm text-muted-foreground">Checking authentication...</span>
              </div>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                size="sm"
              >
                Refresh Page
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server Debug Endpoints */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Session Debug */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Server Session Debug
            </CardTitle>
            <CardDescription>
              GET /api/debug/session endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={fetchSessionDebug}
                disabled={isLoadingSession}
                className="w-full"
                data-testid="fetch-session-debug"
              >
                {isLoadingSession && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Fetch Session Debug
              </Button>
              
              {sessionDebug && (
                <div className="bg-muted p-3 rounded-md">
                  <div className="font-mono text-sm space-y-1">
                    <div><strong>User ID:</strong> {sessionDebug.userId}</div>
                    <div><strong>Email:</strong> {sessionDebug.email}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Workouts Debug */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Workouts Debug
            </CardTitle>
            <CardDescription>
              GET /api/debug/workouts endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={fetchWorkoutsDebug}
                disabled={isLoadingWorkouts}
                className="w-full"
                data-testid="fetch-workouts-debug"
              >
                {isLoadingWorkouts && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Fetch Workouts Debug
              </Button>
              
              {workoutsDebug && (
                <div className="bg-muted p-3 rounded-md">
                  <div className="font-mono text-sm space-y-1">
                    <div><strong>Count:</strong> {workoutsDebug.count}</div>
                    <div><strong>Last 5 IDs:</strong></div>
                    <ul className="ml-4 list-disc">
                      {workoutsDebug.last5Ids.map((id, index) => (
                        <li key={index} className="truncate">{id}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Suggestions Debug */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Suggestions Debug
            </CardTitle>
            <CardDescription>
              GET /api/suggestions/debug endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={fetchSuggestionDebug}
                  disabled={isLoadingSuggestion || !user}
                  className="flex-1"
                  data-testid="fetch-suggestion-debug"
                >
                  {isLoadingSuggestion && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {!user ? "Sign in to test" : "Fetch Debug"}
                </Button>
                <Button 
                  onClick={recomputeSuggestion}
                  disabled={isRegenerating || !user}
                  variant="secondary"
                  data-testid="recompute-suggestion"
                >
                  {isRegenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              
              {!user && (
                <div className="text-sm text-muted-foreground">
                  Authentication required: The suggestion debug buttons are disabled until user session loads. 
                  If you're logged in but buttons remain disabled, try refreshing the page.
                </div>
              )}
              
              {suggestionDebug && (
                <div className="bg-muted p-3 rounded-md">
                  <div className="font-mono text-xs space-y-2 max-h-80 overflow-auto">
                    <div><strong>User ID:</strong> {suggestionDebug.userId}</div>
                    <div><strong>Date:</strong> {suggestionDebug.date}</div>
                    
                    <div className="mt-3">
                      <strong>Algorithm Inputs:</strong>
                    </div>
                    <div className="ml-2 space-y-1">
                      <div><strong>Workouts:</strong> {suggestionDebug.inputs.workouts?.length || 0} entries</div>
                      <div><strong>Health Data:</strong> {suggestionDebug.inputs.health ? 'Available' : 'None'}</div>
                      <div><strong>PRs:</strong> {suggestionDebug.inputs.prs?.length || 0} entries</div>
                    </div>
                    
                    {suggestionDebug.suggestion && (
                      <div className="mt-3">
                        <strong>Current Suggestion:</strong>
                        <pre className="mt-1 text-xs bg-background p-2 rounded border max-h-40 overflow-auto">
                          {JSON.stringify(suggestionDebug.suggestion, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    <details className="mt-3">
                      <summary className="cursor-pointer"><strong>Raw Debug Data:</strong></summary>
                      <pre className="mt-1 text-xs bg-background p-2 rounded border max-h-60 overflow-auto">
                        {JSON.stringify(suggestionDebug, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-1 gap-6">
        {/* Email Provider Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Provider Status
            </CardTitle>
            <CardDescription>
              GET /api/dev/debug/email endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={fetchEmailStatus}
                disabled={isLoadingEmail}
                className="w-full"
                data-testid="fetch-email-status"
              >
                {isLoadingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Check Email Provider
              </Button>
              
              {emailStatus && (
                <div className="bg-muted p-3 rounded-md">
                  <div className="font-mono text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <strong>Admin Connectivity:</strong> 
                      <Badge variant={emailStatus.adminConnectivity ? "default" : "destructive"}>
                        {emailStatus.adminConnectivity ? "✓" : "✗"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong>Email Confirm:</strong> 
                      <Badge variant={emailStatus.emailConfirm ? "default" : "destructive"}>
                        {emailStatus.emailConfirm ? "✓" : "✗"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong>Magic Links:</strong> 
                      <Badge variant={emailStatus.passwordless ? "default" : "destructive"}>
                        {emailStatus.passwordless ? "✓" : "✗"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong>Custom SMTP:</strong> 
                      <Badge variant={emailStatus.customSmtpConfigured ? "default" : "secondary"}>
                        {emailStatus.customSmtpConfigured ? "Resend" : "Default"}
                      </Badge>
                    </div>
                    <div><strong>Environment:</strong> {emailStatus.environment}</div>
                    <div><strong>User Count:</strong> {emailStatus.userCount}</div>
                    <div><strong>Checked:</strong> {new Date(emailStatus.timestamp).toLocaleTimeString()}</div>
                    {emailStatus.error && (
                      <div className="text-red-600">
                        <strong>Error:</strong> {emailStatus.error}
                        {emailStatus.details && (
                          <div className="text-xs mt-1">{emailStatus.details}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Generate Workout Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Generate Workout Test
          </CardTitle>
          <CardDescription>
            Test POST /api/generate-workout with minimal payload
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={pingGenerateWorkout}
            disabled={isGenerating || !user}
            className="w-full"
            data-testid="ping-generate-workout"
          >
            {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {!user ? "Sign in to test" : "Ping Generate (Mock)"}
          </Button>
          
          {!user && (
            <p className="text-sm text-muted-foreground mt-2">
              You must be signed in to test workout generation
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}