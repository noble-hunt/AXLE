import { cn } from "@/lib/utils"

interface SectionTitleProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function SectionTitle({ title, subtitle, action, className }: SectionTitleProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {action}
    </div>
  )
}
