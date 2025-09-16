import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  icon?: React.ReactNode
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "secondary"
}

export function PrimaryButton({ 
  children, 
  icon, 
  size = "lg", 
  variant = "primary",
  className,
  ...props 
}: PrimaryButtonProps) {
  const sizeClasses = {
    sm: "py-2 px-4 text-sm",
    md: "py-3 px-5 text-base",
    lg: "py-4 px-6 text-lg"
  }

  const variantClasses = {
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    secondary: "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
  }

  return (
    <Button
      className={cn(
        "w-full font-semibold rounded-2xl transition-colors duration-200 flex items-center justify-center gap-2 card-shadow",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
      data-testid="primary-button"
    >
      {icon}
      {children}
    </Button>
  )
}
