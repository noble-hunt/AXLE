import { Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"

interface LoadingStateProps {
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingState({ 
  message = "Loading...", 
  className = "",
  size = "md" 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  }

  return (
    <div className={`flex flex-col items-center justify-center py-8 ${className}`} data-testid="loading-state">
      <Loader2 className={`${sizeClasses[size]} text-primary animate-spin mb-3`} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function LoadingCard({ message, className }: { message?: string, className?: string }) {
  return (
    <Card className={`p-6 card-shadow border border-border ${className}`}>
      <LoadingState message={message} />
    </Card>
  )
}

export function LoadingSkeleton({ className = "", rows = 3 }: { className?: string, rows?: number }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="skeleton-loader">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-muted rounded-md w-full mb-2"></div>
          <div className="h-4 bg-muted rounded-md w-3/4"></div>
        </div>
      ))}
    </div>
  )
}