import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if we have recovery session from email link
    const checkRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session or not a recovery session, redirect to login
      if (!session || !session.user) {
        toast({
          title: "Invalid reset link",
          description: "The password reset link is invalid or has expired. Please try again.",
          variant: "destructive",
        });
        setLocation("/auth/login");
      }
    };

    checkRecoverySession();
  }, [setLocation, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setIsComplete(true);
      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        setLocation("/auth/login");
      }, 2000);

    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Failed to update your password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold">Password Updated!</h2>
                <p className="text-muted-foreground text-sm">
                  Your password has been successfully changed. You'll be redirected to the login page.
                </p>
                <Link href="/auth/login" data-testid="link-login">
                  <Button className="w-full">
                    Continue to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/auth/login" data-testid="link-back">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground mt-2">
            Enter your new password
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Password</CardTitle>
            <CardDescription>
              Choose a strong password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                    data-testid="input-new-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !password.trim() || !confirmPassword.trim()}
                data-testid="button-reset-password"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}