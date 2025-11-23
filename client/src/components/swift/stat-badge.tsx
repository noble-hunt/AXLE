import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

const statBadgeVariants = cva(
  "inline-flex items-center gap-3 rounded-xl text-caption font-semibold transition-all duration-200 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-primary/10 text-primary border border-primary/20",
        success: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
        warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
        info: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
        destructive: "bg-destructive/10 text-destructive",
      },
      size: {
        sm: "min-h-6 px-2 py-1 text-[11px]",
        default: "min-h-12 px-3 py-2",
        lg: "min-h-14 px-4 py-3 text-body",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface StatBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statBadgeVariants> {
  asChild?: boolean;
  value?: string | number;
  label?: string;
  icon?: React.ReactNode;
}

const StatBadge = forwardRef<HTMLDivElement, StatBadgeProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    value,
    label,
    icon,
    children,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={cn(statBadgeVariants({ variant, size, className }))}
        data-testid="swift-stat-badge"
        {...props}
      >
        {icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        
        <div className="flex flex-col items-start min-w-0">
          {value !== undefined && (
            <span className="font-bold text-foreground truncate" data-testid="swift-stat-value">
              {value}
            </span>
          )}
          {label && (
            <span className="text-[10px] opacity-80 truncate" data-testid="swift-stat-label">
              {label}
            </span>
          )}
        </div>
        
        {children}
      </Comp>
    );
  }
);

StatBadge.displayName = "StatBadge";

export { StatBadge, statBadgeVariants };