import { useEffect, useRef, useState } from "react";
import { Switch, Route, useSearch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { Overlay } from "@/dev/Overlay";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Workout from "@/pages/workout";
import WorkoutDetail from "@/pages/workout-detail";
import History from "@/pages/history";
import PRs from "@/pages/prs";
import Achievements from "@/pages/achievements";
import Profile from "@/pages/profile";
import Connect from "@/pages/connect";
import Reports from "@/pages/reports";
import WorkoutGenerate from "@/pages/workout-generate";
import DevEnv from "@/pages/dev-env";
import Debug from "@/pages/dev/Debug";
import Tokens from "@/pages/dev/Tokens";
import Components from "@/pages/dev/Components";
import Compare from "@/pages/dev/Compare";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Callback from "@/pages/auth/Callback";

function OverlayWrapper() {
  const search = useSearch();
  const [overlayImage, setOverlayImage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const overlay = params.get('overlay');
    setOverlayImage(overlay);
  }, [search]);

  const handleCloseOverlay = () => {
    // Remove overlay parameter from URL
    const params = new URLSearchParams(search);
    params.delete('overlay');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.replaceState({}, '', newUrl);
    setOverlayImage(null);
  };

  return (
    <>
      <Switch>
        {/* Public routes */}
        <Route path="/auth/login" component={Login} />
        <Route path="/auth/register" component={Register} />
        <Route path="/auth/callback" component={Callback} />
        
        {/* Home route - accessible to all */}
        <Route path="/" component={Home} />
        
        {/* Main navigation routes - accessible to guests and authenticated users */}
        <Route path="/workout" component={Workout} />
        <Route path="/workout/:id" component={WorkoutDetail} />
        <Route path="/history" component={History} />
        <Route path="/prs" component={PRs} />
        <Route path="/achievements" component={Achievements} />
        <Route path="/profile" component={Profile} />
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
        <Route path="/dev/tokens" component={Tokens} />
        <Route path="/dev/components" component={Components} />
        <Route path="/dev/compare" component={Compare} />
        <Route component={NotFound} />
      </Switch>
      
      {/* Overlay - rendered on any route when overlay parameter is present */}
      {overlayImage && (
        <Overlay imageName={overlayImage} onClose={handleCloseOverlay} />
      )}
    </>
  );
}

function Router() {
  return <OverlayWrapper />;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setAuthInitialized, hydrateFromDb, clearStoreForGuest } = useAppStore();
  const initializedRef = useRef(false);
  
  // Access store's get method for upsertProfile
  const get = useAppStore.getState;

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setAuth(session.user, session);
          if (!initializedRef.current) {
            try {
              // Upsert profile first (create if doesn't exist)
              await get().upsertProfile(session.user.id, session.user.email || '');
              
              // Then hydrate all data
              await hydrateFromDb(session.user.id);
              initializedRef.current = true;
            } catch (hydrateError) {
              console.error('❌ Database hydration failed, using local data:', hydrateError);
              // Don't clear auth - keep authenticated state but use local data
            }
          }
          // Set authInitialized after auth state is set
          setAuthInitialized(true);
        } else {
          clearAuth();
          clearStoreForGuest();
          // Set authInitialized after clearing auth state
          setAuthInitialized(true);
        }
      } catch (error) {
        console.error('❌ Auth session check failed:', error);
        // Don't clear auth on transient network/session check failures
        // Keep existing auth state and let user retry
        // Still set initialized to true so app doesn't get stuck
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
              // Upsert profile first (create if doesn't exist)
              await get().upsertProfile(session.user.id, session.user.email || '');
              
              // Then hydrate all data
              await hydrateFromDb(session.user.id);
              initializedRef.current = true;
            } catch (hydrateError) {
              console.error('❌ Database hydration failed on sign-in, using local data:', hydrateError);
              // Keep authenticated state but log hydration failure
            }
          }
          setAuthInitialized(true);
        } else {
          clearAuth();
          clearStoreForGuest();
          initializedRef.current = false;
          setAuthInitialized(true);
        }
      } catch (error) {
        console.error('❌ Auth state change failed:', error);
        // Only clear auth if auth state check itself failed
        if (session === null) {
          clearAuth();
          clearStoreForGuest();
          initializedRef.current = false;
        }
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
