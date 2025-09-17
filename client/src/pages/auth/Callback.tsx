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
          toast({
            title: "Welcome back!",
            description: "You've been signed in successfully.",
          });
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