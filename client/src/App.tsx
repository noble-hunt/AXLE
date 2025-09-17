import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Workout from "@/pages/workout";
import WorkoutDetail from "@/pages/workout-detail";
import History from "@/pages/history";
import PRs from "@/pages/prs";
import Achievements from "@/pages/achievements";
import Connect from "@/pages/connect";
import Reports from "@/pages/reports";
import WorkoutGenerate from "@/pages/workout-generate";
import DevEnv from "@/pages/dev-env";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Callback from "@/pages/auth/Callback";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth/login" component={Login} />
      <Route path="/auth/register" component={Register} />
      <Route path="/auth/callback" component={Callback} />
      
      {/* Home route - accessible to all */}
      <Route path="/" component={Home} />
      
      {/* Protected routes */}
      <Route path="/workout" component={() => (
        <ProtectedRoute>
          <Workout />
        </ProtectedRoute>
      )} />
      <Route path="/workout/:id" component={() => (
        <ProtectedRoute>
          <WorkoutDetail />
        </ProtectedRoute>
      )} />
      <Route path="/history" component={() => (
        <ProtectedRoute>
          <History />
        </ProtectedRoute>
      )} />
      <Route path="/prs" component={() => (
        <ProtectedRoute>
          <PRs />
        </ProtectedRoute>
      )} />
      <Route path="/achievements" component={() => (
        <ProtectedRoute>
          <Achievements />
        </ProtectedRoute>
      )} />
      <Route path="/connect" component={() => (
        <ProtectedRoute>
          <Connect />
        </ProtectedRoute>
      )} />
      <Route path="/reports" component={() => (
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      )} />
      <Route path="/generate-workout" component={WorkoutGenerate} />
      <Route path="/dev/env" component={DevEnv} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setAuthInitialized, loadServerData, clearUserData } = useAppStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuth(session.user, session);
      } else {
        clearAuth();
      }
      // Mark auth as initialized after initial session check
      setAuthInitialized(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setAuth(session.user, session);
        // Load server data when user logs in
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await loadServerData(session.access_token);
        }
      } else {
        clearAuth();
        clearUserData();
      }
      // Ensure auth is marked as initialized on any auth state change
      setAuthInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, [setAuth, clearAuth, setAuthInitialized, loadServerData, clearUserData]);

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="axle-ui-theme">
        <TooltipProvider>
          <AuthProvider>
            <AppLayout>
              <Toaster />
              <Router />
            </AppLayout>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
