import { Activity, Sun, Moon, User, LogOut, Settings, Link as LinkIcon } from "lucide-react"
import { useTheme } from "@/components/ui/theme-provider"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/useAppStore"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useLocation } from "wouter"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SiGoogle } from "react-icons/si"

export function TopAppBar() {
  const { theme, setTheme } = useTheme()
  const { user, profile, clearAuth } = useAppStore()
  const { toast } = useToast()
  const [, setLocation] = useLocation()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleSignOut = async () => {
    try {
      // Clear auth state first
      clearAuth()
      
      // Also call clearStoreForGuest to ensure all user data is removed  
      const { clearStoreForGuest } = useAppStore.getState()
      clearStoreForGuest()
      
      // Call Supabase sign out to clear server session
      await supabase.auth.signOut()
      
      toast({
        title: "Signed out",
        description: "You've been signed out successfully.",
      })
      
      // Redirect to login
      setLocation("/auth/login")
      
    } catch (error) {
      console.error("Sign out error:", error)
      toast({
        title: "Sign out failed", 
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase()
  }

  const isGoogleLinked = () => {
    return (profile as any)?.providers?.includes("google") || false
  }

  const getLinkedProviders = () => {
    return (profile as any)?.providers || []
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return <SiGoogle className="w-3 h-3" />
      default:
        return null
    }
  }

  const handleLinkGoogle = async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
      })

      if (error) {
        toast({
          title: "Google linking failed",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Google linking initiated",
          description: "Please complete the linking process in the new window.",
        })
      }
    } catch (error) {
      toast({
        title: "Google linking failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-2xl bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="app-title">AXLE</h1>
        </div>
        
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-2xl" data-testid="profile-menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.email || "U")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  {profile?.username && (
                    <p className="text-sm font-medium leading-none" data-testid="user-username">
                      {profile.username}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground" data-testid="user-email">
                    {user.email}
                  </p>
                  {getLinkedProviders().length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {getLinkedProviders().map((provider: string) => (
                        <Badge 
                          key={provider} 
                          variant="secondary" 
                          className="text-xs flex items-center gap-1 px-2 py-1"
                          data-testid={`badge-provider-${provider}`}
                        >
                          {getProviderIcon(provider)}
                          <span className="capitalize">{provider}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme} data-testid="theme-toggle">
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                <span>Toggle theme</span>
              </DropdownMenuItem>
              {!isGoogleLinked() && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLinkGoogle} data-testid="link-google">
                    <SiGoogle className="mr-2 h-4 w-4" />
                    <span>Link Google</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} data-testid="sign-out">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            onClick={toggleTheme}
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-2xl bg-card hover:bg-accent transition-colors duration-200 card-shadow"
            data-testid="theme-toggle"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        )}
      </div>
    </header>
  )
}
