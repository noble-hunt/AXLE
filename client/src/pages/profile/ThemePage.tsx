import { Card } from "@/components/swift/card"
import { useTheme } from "@/components/ui/theme-provider"
import { ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import { fadeIn, slideUp } from "@/lib/motion-variants"

export default function ThemePage() {
  const { theme, setTheme } = useTheme()
  
  const themes = [
    {
      id: "boomer-light" as const,
      name: "Boomer Light",
      description: "Classic vibes for those who remember when fitness apps weren't a thing",
      emoji: "☀️"
    },
    {
      id: "rainbow-sherbet" as const,
      name: "Rainbow Sherbet",
      description: "Dark mode but make it electric—like a rave at your local CrossFit box",
      emoji: "🌈"
    },
    {
      id: "mocha-professional" as const,
      name: "Mocha Professional",
      description: "Business casual for your gains—warm browns like your morning coffee",
      emoji: "☕"
    },
    {
      id: "deep-blue-bush" as const,
      name: "Deep Blue Bush",
      description: "Navy seals meet forest vibes—crisp blues and greens for peak focus",
      emoji: "🌊"
    }
  ]
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <motion.div
        className="container mx-auto px-4 py-6 max-w-sm space-y-6"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <motion.div variants={slideUp}>
          <h1 className="text-heading font-bold text-foreground mb-2">App Theme</h1>
          <p className="text-body text-muted-foreground">
            Choose your visual vibe. Tap any theme to preview it instantly.
          </p>
        </motion.div>

        {/* Theme Options */}
        <motion.div variants={slideUp}>
          <Card className="divide-y divide-border">
            {themes.map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => setTheme(themeOption.id)}
                className={`
                  w-full px-5 py-4 flex items-center gap-4 transition-all duration-200
                  hover:bg-accent/10 active:bg-accent/20
                  ${theme === themeOption.id ? 'bg-primary/10' : ''}
                `}
                data-testid={`theme-${themeOption.id}`}
              >
                <div className="text-3xl">{themeOption.emoji}</div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-body font-semibold text-foreground">
                      {themeOption.name}
                    </p>
                    {theme === themeOption.id && (
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground">
                    {themeOption.description}
                  </p>
                </div>
                <ChevronRight className={`
                  w-5 h-5 transition-all
                  ${theme === themeOption.id ? 'text-primary' : 'text-muted-foreground'}
                `} />
              </button>
            ))}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
