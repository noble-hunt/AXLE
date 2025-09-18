import { useEffect, useRef } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
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
import Debug from "@/pages/dev/Debug";
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
      <Route path="/history" component={History} />
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
      <Route path="/dev/debug" component={Debug} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setAuthInitialized, hydrateFromDb, clearStoreForGuest } = useAppStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setAuth(session.user, session);
          if (!initializedRef.current) {
            try {
              await hydrateFromDb(session.user.id);
              initializedRef.current = true;
            } catch (hydrateError) {
              console.error('❌ Database hydration failed, using local data:', hydrateError);
              // Don't clear auth - keep authenticated state but use local data
            }
          }
        } else {
          clearAuth();
          clearStoreForGuest();
        }
      } catch (error) {
        console.error('❌ Auth session check failed:', error);
        // Don't clear auth on transient network/session check failures
        // Keep existing auth state and let user retry
      } finally {
        setAuthInitialized(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, session) => {
      try {
        if (session?.user) {
          setAuth(session.user, session);
          // Only hydrate on actual sign-in events, not initial session
          if (evt === 'SIGNED_IN' && !initializedRef.current) {
            try {
              await hydrateFromDb(session.user.id);
              initializedRef.current = true;
            } catch (hydrateError) {
              console.error('❌ Database hydration failed on sign-in, using local data:', hydrateError);
              // Keep authenticated state but log hydration failure
            }
          }
        } else {
          clearAuth();
          clearStoreForGuest();
          initializedRef.current = false;
        }
      } catch (error) {
        console.error('❌ Auth state change failed:', error);
        // Only clear auth if auth state check itself failed
        if (session === null) {
          clearAuth();
          clearStoreForGuest();
          initializedRef.current = false;
        }
      } finally {
        setAuthInitialized(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

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
