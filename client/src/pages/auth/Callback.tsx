import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";

export default function Callback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setProfile } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleAuthCallback = async () => {
      try {
        // Check URL params to determine the type of authentication flow
        const urlParams = new URLSearchParams(window.location.search);
        const urlHash = window.location.hash;
        const isEmailVerification = urlParams.has('type') || urlHash.includes('type=') || urlHash.includes('confirmation');
        
        // Handle OAuth code exchange (required for PKCE-based OAuth)
        let session = null;
        let error = null;
        
        if (urlParams.has('code') || urlHash.includes('access_token') || urlHash.includes('code=')) {
          // This is an OAuth callback - exchange the code for a session
          console.log('OAuth callback detected, exchanging code for session');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          session = data.session;
          error = exchangeError;
        } else {
          // Regular session check
          const { data, error: sessionError } = await supabase.auth.getSession();
          session = data.session;
          error = sessionError;
        }

        if (error) {
          console.error('Auth callback error:', error);
          setIsProcessing(false);
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
            // Improved provider detection using identities
            const hasGoogleIdentity = session.user.identities?.some(
              (identity) => identity.provider === 'google'
            );
            
            // Check if this is an identity linking flow (user has multiple identities)
            const isIdentityLinking = session.user.identities && session.user.identities.length > 1;
            
            if (hasGoogleIdentity && isIdentityLinking) {
              // This is identity linking - user already had an account and linked Google
              toast({
                title: "Google account linked!",
                description: "Your Google account has been successfully linked to your AXLE profile.",
              });
              
              // Update the profile's providers array using proper API client
              try {
                const { apiRequest } = await import("@/lib/queryClient");
                await apiRequest('POST', '/api/profiles/providers', {
                  provider: 'google'
                });
                
                // Refresh profile data to show updated providers immediately
                const profileResponse = await apiRequest('GET', '/api/profiles/providers');
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json();
                  // Update the store with the full refreshed profile including providers
                  setProfile(profileData.profile);
                }
              } catch (error) {
                console.error('Failed to update providers:', error);
              }
            } else if (hasGoogleIdentity) {
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
          setIsProcessing(false);
          setLocation("/");
        } else {
          // No session found - wait longer for OAuth callback to process
          // This prevents immediate redirect during OAuth flow
          timeoutId = setTimeout(() => {
            console.log('No session found after waiting, redirecting to login');
            toast({
              title: "Authentication timeout",
              description: "Please try signing in again.",
              variant: "destructive",
            });
            setLocation("/auth/login");
          }, 6000); // Wait 6 seconds before redirecting (increased from 3s)
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setIsProcessing(false);
        toast({
          title: "Authentication failed",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
        setLocation("/auth/login");
      }
    };

    handleAuthCallback();
    
    // Cleanup function to clear timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" data-testid="callback-spinner" />
        <div>
          <h2 className="text-lg font-semibold">
            {isProcessing ? "Processing authentication..." : "Signing you in..."}
          </h2>
          <p className="text-muted-foreground text-sm">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
}