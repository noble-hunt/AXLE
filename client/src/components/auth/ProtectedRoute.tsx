import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAppStore } from "@/store/useAppStore";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, session, authInitialized } = useAppStore();

  console.log('🔒 ProtectedRoute state:', { 
    authInitialized, 
    hasUser: !!user, 
    hasSession: !!session 
  });

  useEffect(() => {
    // Only redirect if auth is initialized and no user/session
    if (authInitialized && (!user || !session)) {
      console.log('🔒 Redirecting to login - no user/session');
      setLocation("/auth/login");
    }
  }, [user, session, authInitialized, setLocation]);

  // Show loading while auth is initializing
  if (!authInitialized) {
    console.log('🔒 Auth not initialized, showing loading screen');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Loading...</h2>
            <p className="text-muted-foreground text-sm">Checking authentication</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect immediately if not authenticated - no loading screen
  if (!user || !session) {
    setLocation("/auth/login");
    return null;
  }

  return <>{children}</>;
}