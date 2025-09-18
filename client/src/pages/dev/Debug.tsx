import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Loader2, Database, User as UserIcon, Zap } from "lucide-react";

interface DebugSessionData {
  userId: string;
  email: string;
}

interface DebugWorkoutsData {
  count: number;
  last5Ids: string[];
}

export default function Debug() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [sessionDebug, setSessionDebug] = useState<DebugSessionData | null>(null);
  const [workoutsDebug, setWorkoutsDebug] = useState<DebugWorkoutsData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Get current Supabase session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    getSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Not Authenticated</Badge>
              <span className="text-sm text-muted-foreground">No active session</span>
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