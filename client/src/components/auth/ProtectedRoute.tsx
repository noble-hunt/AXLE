import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAppStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, session, authInitialized } = useAppStore();

  useEffect(() => {
    // Only redirect if auth is initialized and no user/session
    if (authInitialized && (!user || !session)) {
      setLocation("/auth/login");
    }
  }, [user, session, authInitialized, setLocation]);

  // Show loading while auth is initializing
  if (!authInitialized) {
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