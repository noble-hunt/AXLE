import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function Callback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check URL params to determine the type of authentication flow
        const urlParams = new URLSearchParams(window.location.search);
        const urlHash = window.location.hash;
        const isEmailVerification = urlParams.has('type') || urlHash.includes('type=') || urlHash.includes('confirmation');
        
        // Get the session from URL parameters
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Authentication failed",
            description: error.message,
            variant: "destructive",
          });
          setLocation("/auth/login");
          return;
        }

        if (session) {
          // Check if this was an email verification flow
          if (isEmailVerification) {
            toast({
              title: "Email verified!",
              description: "Your account has been verified successfully. Welcome to AXLE!",
            });
          } else {
            // Check if this is a Google OAuth flow
            const isGoogleOAuth = session.user.app_metadata?.providers?.includes('google') || 
                                 session.user.user_metadata?.provider === 'google';
            
            // Check if this is an identity linking flow (user already had an account)
            const isIdentityLinking = session.user.identities && session.user.identities.length > 1;
            
            if (isGoogleOAuth && isIdentityLinking) {
              // This is identity linking - user already had an account and linked Google
              toast({
                title: "Google account linked!",
                description: "Your Google account has been successfully linked to your AXLE profile.",
              });
              
              // Update the profile's providers array
              try {
                await fetch('/api/profiles/providers', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId: session.user.id,
                    provider: 'google'
                  }),
                });
              } catch (error) {
                console.error('Failed to update providers:', error);
              }
            } else if (isGoogleOAuth) {
              // This is a fresh Google sign-in
              toast({
                title: "Welcome to AXLE!",
                description: "You've signed in with Google successfully.",
              });
            } else {
              // Regular sign-in (magic link, etc.)
              toast({
                title: "Welcome back!",
                description: "You've been signed in successfully.",
              });
            }
          }
          setLocation("/");
        } else {
          // No session found, redirect to login
          setLocation("/auth/login");
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast({
          title: "Authentication failed",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
        setLocation("/auth/login");
      }
    };

    handleAuthCallback();
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Signing you in...</h2>
          <p className="text-muted-foreground text-sm">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
}