import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  title?: string;
  value?: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "elevated" | "accent";
}

const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ 
    className, 
    asChild = false, 
    title,
    value,
    unit,
    change,
    changeLabel,
    subtitle,
    icon,
    variant = "default",
    children,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "div";

    const cardVariants = {
      default: "bg-card border border-border shadow-soft",
      elevated: "bg-card shadow-card border-0",
      accent: "bg-primary/5 border border-primary/20 shadow-soft",
    };

    const getTrendIcon = () => {
      if (change === undefined || change === 0) return <Minus className="h-3 w-3" />;
      return change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
    };

    const getTrendColor = () => {
      if (change === undefined || change === 0) return "text-muted-foreground";
      return change > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          "rounded-xl p-6 transition-all duration-300 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          cardVariants[variant],
          className
        )}
        data-testid="swift-metric-card"
        {...props}
      >
        <div className="flex items-start justify-between space-x-4">
          <div className="flex-1 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              {icon && (
                <span className="text-muted-foreground" aria-hidden="true">
                  {icon}
                </span>
              )}
              {title && (
                <h3 className="text-caption font-medium text-muted-foreground truncate" data-testid="swift-metric-title">
                  {title}
                </h3>
              )}
            </div>

            {/* Value */}
            {value !== undefined && (
              <div className="flex items-baseline gap-1">
                <span className="text-title font-bold text-foreground" data-testid="swift-metric-value">
                  {value}
                </span>
                {unit && (
                  <span className="text-body text-muted-foreground" data-testid="swift-metric-unit">
                    {unit}
                  </span>
                )}
              </div>
            )}

            {/* Change/Trend */}
            {(change !== undefined || changeLabel) && (
              <div className="flex items-center gap-1">
                <span className={cn("flex items-center gap-1 text-caption", getTrendColor())} data-testid="swift-metric-change">
                  {getTrendIcon()}
                  {change !== undefined && (
                    <span>
                      {change > 0 ? '+' : ''}{change}%
                    </span>
                  )}
                  {changeLabel && (
                    <span className="text-muted-foreground">
                      {changeLabel}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Subtitle */}
            {subtitle && (
              <p className="text-caption text-muted-foreground" data-testid="swift-metric-subtitle">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {children}
      </Comp>
    );
  }
);

MetricCard.displayName = "MetricCard";

export { MetricCard };