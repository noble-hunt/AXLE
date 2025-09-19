import { Home, Activity, Heart, Trophy, MoreHorizontal } from "lucide-react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Activity, label: "Workout", path: "/workout" },
  { icon: Heart, label: "Health", path: "/health" },
  { icon: Trophy, label: "PRs", path: "/prs" },
  { icon: MoreHorizontal, label: "More", path: "/profile" }
]

export function BottomNavigation() {
  const [location] = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border">
      <div className="max-w-sm mx-auto px-4 py-2">
        <div className="flex justify-around items-center">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location === path
            return (
              <Link key={path} href={path}>
                <button
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  data-testid={`nav-${label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
