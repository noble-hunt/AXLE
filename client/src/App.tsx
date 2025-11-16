import { useEffect, useRef, useState } from "react";
import { Switch, Route, useSearch, Redirect } from "wouter";
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
import StatsOverview from "@/pages/stats-overview";
import PRStats from "@/pages/pr-stats";
import Health from "@/pages/health";
import PRs from "@/pages/prs";
import Achievements from "@/pages/achievements";
import Profile from "@/pages/profile";
import EditProfile from "@/pages/EditProfile";
import Connect from "@/pages/connect";
import Reports from "@/pages/reports";
import WorkoutGenerate from "@/pages/workout/generate";
import LogFreeform from "@/pages/workout/LogFreeform";
import DevEnv from "@/pages/dev-env";
import Debug from "@/pages/dev/Debug";
import Tokens from "@/pages/dev/Tokens";
import Components from "@/pages/dev/Components";
import Compare from "@/pages/dev/Compare";
import Groups from "@/pages/groups";
import NewGroup from "@/pages/groups/NewGroup";
import GroupInvite from "@/pages/groups/GroupInvite";
import GroupJoin from "@/pages/groups/GroupJoin";
import InviteToGroup from "@/pages/groups/InviteToGroup";
import JoinGroupPage from "@/pages/groups/JoinGroupPage";
import GroupFeedPage from "@/pages/groups/GroupFeed";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Callback from "@/pages/auth/Callback";
import ResetPassword from "@/pages/auth/ResetPassword";
import PrivacyPolicy from "@/pages/legal/privacy";
import TermsOfService from "@/pages/legal/terms";
import { HealthVizPlayground } from "@/components/HealthVizPlayground";

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
        <Route path="/auth/reset-password" component={ResetPassword} />
        
        {/* Legal routes - accessible to all */}
        <Route path="/legal/privacy" component={PrivacyPolicy} />
        <Route path="/legal/terms" component={TermsOfService} />
        
        {/* Testing playground */}
        <Route path="/playground" component={HealthVizPlayground} />
        
        {/* Home route - accessible to all */}
        <Route path="/" component={Home} />
        
        {/* Main navigation routes - accessible to guests and authenticated users */}
        <Route path="/workout" component={Workout} />
        <Route path="/workout/log" component={LogFreeform} />
        {/* Canonical generator path - must come before /workout/:id to avoid ID capture */}
        <Route path="/workout/generate" component={WorkoutGenerate} />
        <Route path="/workout/:id" component={WorkoutDetail} />
        <Route path="/history" component={History} />
        <Route path="/stats" component={StatsOverview} />
        <Route path="/pr-stats" component={PRStats} />
        <Route path="/health" component={Health} />
        <Route path="/prs" component={PRs} />
        <Route path="/achievements" component={Achievements} />
        <Route path="/profile" component={() => (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        )} />
        <Route path="/profile/edit" component={() => (
          <ProtectedRoute>
            <EditProfile />
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
        
        {/* Legacy aliases → redirect to canonical path with query params preserved */}
        <Route path="/workouts/generate" component={() => {
          const search = useSearch();
          return <Redirect to={`/workout/generate${search ? `?${search}` : ''}`} />;
        }} />
        <Route path="/generate-workout" component={() => {
          const search = useSearch();
          return <Redirect to={`/workout/generate${search ? `?${search}` : ''}`} />;
        }} />
        <Route path="/workout-generate" component={() => {
          const search = useSearch();
          return <Redirect to={`/workout/generate${search ? `?${search}` : ''}`} />;
        }} />
        <Route path="/workout/new" component={() => {
          const search = useSearch();
          return <Redirect to={`/workout/generate${search ? `?${search}` : ''}`} />;
        }} />
        <Route path="/suggest" component={() => {
          return <Redirect to="/workout" replace />;
        }} />
        <Route path="/groups" component={() => (
          <ProtectedRoute>
            <Groups />
          </ProtectedRoute>
        )} />
        <Route path="/groups/new" component={() => (
          <ProtectedRoute>
            <NewGroup />
          </ProtectedRoute>
        )} />
        <Route path="/groups/:id" component={() => (
          <ProtectedRoute>
            <GroupFeedPage />
          </ProtectedRoute>
        )} />
        <Route path="/groups/:id/invite" component={() => (
          <ProtectedRoute>
            <InviteToGroup />
          </ProtectedRoute>
        )} />
        <Route path="/groups/join/:id" component={() => (
          <ProtectedRoute>
            <GroupJoin />
          </ProtectedRoute>
        )} />
        <Route path="/join/:code" component={() => (
          <ProtectedRoute>
            <GroupJoin />
          </ProtectedRoute>
        )} />
        <Route path="/g/:id" component={JoinGroupPage} />
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
          // Set authInitialized immediately after auth state is set
          setAuthInitialized(true);
          
          // Hydrate data in background (don't block auth initialization)
          if (!initializedRef.current) {
            // Run hydration in background without blocking
            (async () => {
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
            })();
          }
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
          setAuthInitialized(true);
          
          // Only hydrate on actual sign-in events, not initial session
          if (evt === 'SIGNED_IN' && !initializedRef.current) {
            // Run hydration in background without blocking
            (async () => {
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
            })();
          }
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
