import { createContext, useContext, useEffect, useState } from "react"

type Theme = "rainbow-sherbet" | "boomer-light" | "mocha-professional" | "deep-blue-bush"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "boomer-light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// Migrate legacy theme values to new theme system
function normalizeLegacyTheme(storedTheme: string | null, defaultTheme: Theme): Theme {
  if (!storedTheme) return defaultTheme
  
  // Map legacy values to new themes
  const legacyMapping: Record<string, Theme> = {
    "light": "boomer-light",
    "dark": "rainbow-sherbet",
    "system": "boomer-light", // Default to boomer-light for system preference
  }
  
  // If it's a legacy value, migrate it
  if (storedTheme in legacyMapping) {
    return legacyMapping[storedTheme]
  }
  
  // If it's already a new theme value, use it
  const validThemes: Theme[] = ["rainbow-sherbet", "boomer-light", "mocha-professional", "deep-blue-bush"]
  if (validThemes.includes(storedTheme as Theme)) {
    return storedTheme as Theme
  }
  
  // Fallback to default for any unexpected value
  return defaultTheme
}

export function ThemeProvider({
  children,
  defaultTheme = "boomer-light",
  storageKey = "axle-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    const normalizedTheme = normalizeLegacyTheme(storedTheme, defaultTheme)
    
    // If we normalized a legacy value, update localStorage immediately
    if (storedTheme && storedTheme !== normalizedTheme) {
      localStorage.setItem(storageKey, normalizedTheme)
    }
    
    return normalizedTheme
  })

  useEffect(() => {
    const root = window.document.documentElement

    // Remove ALL possible theme classes (both new and legacy)
    root.classList.remove(
      // New theme classes
      "rainbow-sherbet", 
      "boomer-light", 
      "mocha-professional", 
      "deep-blue-bush",
      // Legacy theme classes
      "light",
      "dark",
      "system"
    )

    // Add the current theme class
    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
