import { TopAppBar } from "./top-app-bar"
import { BottomNavigation } from "./bottom-navigation"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <TopAppBar />
      <main className="flex-1 px-4 py-6 max-w-sm mx-auto w-full space-y-6">
        {children}
        {/* Spacing for bottom navigation */}
        <div className="h-20" />
      </main>
      <BottomNavigation />
    </div>
  )
}
