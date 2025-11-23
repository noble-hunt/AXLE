import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { X } from "lucide-react";

const chipVariants = cva(
  "inline-flex items-center gap-2 rounded-full text-caption font-medium transition-all duration-200 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground border border-border",
        primary: "bg-primary/10 text-primary border border-primary/20",
        accent: "bg-accent/10 text-accent-foreground border border-accent/20",
        success: "bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
        warning: "bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
      },
      size: {
        sm: "h-6 px-3 text-[11px]",
        default: "h-8 px-3",
        lg: "h-10 px-4 text-body",
        xl: "h-11 px-4 text-body",
      },
      interactive: {
        true: "cursor-pointer hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      interactive: false,
    },
  }
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chipVariants> {
  asChild?: boolean;
  onRemove?: () => void;
  removable?: boolean;
}

const Chip = forwardRef<HTMLDivElement, ChipProps>(
  ({ 
    className, 
    variant, 
    size, 
    interactive, 
    asChild = false, 
    onRemove, 
    removable = false,
    children,
    onClick,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "div";
    const isInteractive = interactive || onClick || removable;

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (onClick && !removable) {
        onClick(event);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isInteractive && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        if (onClick && !removable) {
          onClick(event as any);
        }
      }
    };

    const handleRemove = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRemove?.();
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          chipVariants({ variant, size, interactive: !!isInteractive, className })
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        data-testid="swift-chip"
        {...props}
      >
        {children}
        {removable && (
          <button
            type="button"
            onClick={handleRemove}
            className={cn(
              "rounded-full p-0.5 hover:bg-background/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "transition-colors duration-150"
            )}
            aria-label="Remove"
            data-testid="swift-chip-remove"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </Comp>
    );
  }
);

Chip.displayName = "Chip";

export { Chip, chipVariants };