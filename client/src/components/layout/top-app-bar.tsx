import { Activity, Sun, Moon } from "lucide-react"
import { useTheme } from "@/components/ui/theme-provider"
import { Button } from "@/components/ui/button"

export function TopAppBar() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
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
      </div>
    </header>
  )
}
