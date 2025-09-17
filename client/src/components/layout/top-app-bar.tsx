import { Activity, Sun, Moon, User, LogOut, Settings } from "lucide-react"
import { useTheme } from "@/components/ui/theme-provider"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
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

export function TopAppBar() {
  const { theme, setTheme, user, clearAuth } = useAppStore()
  const { toast } = useToast()
  const [, setLocation] = useLocation()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      clearAuth()
      toast({
        title: "Signed out",
        description: "You've been signed out successfully.",
      })
      setLocation("/auth/login")
    } catch (error) {
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
                  <p className="text-sm font-medium leading-none" data-testid="user-email">
                    {user.email}
                  </p>
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
