import { Component, type ReactNode } from "react"
import { Card } from "@/components/swift/card"
import { AlertTriangle } from "lucide-react"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:")
    console.error("Error message:", error?.message)
    console.error("Error stack:", error?.stack)
    console.error("Error info:", errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card data-testid="error-boundary-fallback">
          <div className="flex flex-col items-center text-center gap-3">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div>
              <h3 className="text-subheading font-semibold text-foreground mb-1">
                Something went wrong
              </h3>
              <p className="text-body text-muted-foreground">
                Unable to display this section. Please try refreshing the page.
              </p>
            </div>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}
