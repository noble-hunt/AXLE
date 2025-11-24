import { Calendar, Palette, ArrowLeft } from "lucide-react"
import { useTheme } from "@/components/ui/theme-provider"
import { Button } from "@/components/ui/button"
import { useLocation } from "wouter"

export function TopAppBar() {
  const { theme, setTheme } = useTheme()
  const [location, setLocation] = useLocation()
  
  const isHomePage = location === "/"

  const toggleTheme = () => {
    // Cycle through all 4 themes: boomer-light → rainbow-sherbet → mocha-professional → deep-blue-bush → boomer-light
    const themes = ["boomer-light", "rainbow-sherbet", "mocha-professional", "deep-blue-bush"] as const
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const handleCalendarClick = () => {
    setLocation("/calendar")
  }

  const handleBackClick = () => {
    // Smart back navigation based on current location
    if (location.startsWith("/calendar/")) {
      // From day detail, go back to calendar
      setLocation("/calendar")
    } else {
      // For other pages, go back to home
      setLocation("/")
    }
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md border-b border-border/10 px-4 py-3">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        {/* Left: Back Button (when not on home) + Calendar Icon */}
        <div className="flex items-center gap-2">
          {!isHomePage && (
            <Button
              onClick={handleBackClick}
              size="icon"
              variant="ghost"
              className="w-10 h-10 rounded-2xl bg-card hover:bg-accent transition-colors duration-200 card-shadow"
              data-testid="back-button"
            >
              <ArrowLeft className="h-5 w-5 transition-all" />
              <span className="sr-only">Go back</span>
            </Button>
          )}
          <Button
            onClick={handleCalendarClick}
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-2xl bg-card hover:bg-accent transition-colors duration-200 card-shadow"
            data-testid="calendar-button"
          >
            <Calendar className="h-5 w-5 transition-all" />
            <span className="sr-only">Open calendar</span>
          </Button>
        </div>
        
        {/* Center: AXLE Text */}
        <h1 className="text-xl font-bold tracking-tight absolute left-1/2 transform -translate-x-1/2" data-testid="app-title">AXLE</h1>
        
        {/* Right: Theme Icon */}
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
