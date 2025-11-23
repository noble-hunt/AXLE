import { Activity, Palette, ChevronLeft } from "lucide-react"
import { useTheme } from "@/components/ui/theme-provider"
import { Button } from "@/components/ui/button"
import { useLocation } from "wouter"

export function TopAppBar() {
  const { theme, setTheme } = useTheme()
  const [location] = useLocation()

  const toggleTheme = () => {
    // Cycle through all 4 themes: boomer-light → rainbow-sherbet → mocha-professional → deep-blue-bush → boomer-light
    const themes = ["boomer-light", "rainbow-sherbet", "mocha-professional", "deep-blue-bush"] as const
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const handleBack = () => {
    window.history.back()
  }

  // Show back button on all pages except home
  const showBackButton = location !== "/"

  return (
    <header className="sticky top-0 z-50 bg-white/10 dark:bg-black/10 backdrop-blur-lg border-b border-border/50 px-4 py-3">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button
              onClick={handleBack}
              size="icon"
              variant="ghost"
              className="w-9 h-9 rounded-xl hover:bg-accent/50 transition-colors duration-200"
              data-testid="back-button"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Go back</span>
            </Button>
          )}
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
          <Palette className="h-5 w-5 transition-all" />
          <span className="sr-only">Cycle theme</span>
        </Button>
      </div>
    </header>
  )
}
