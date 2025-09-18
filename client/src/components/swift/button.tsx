import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-body font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-soft hover:shadow-card hover:bg-primary/90",
        secondary:
          "bg-surface border border-border text-foreground shadow-soft hover:shadow-card hover:bg-muted",
        ghost:
          "text-foreground hover:bg-muted/50 hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:shadow-card hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3 py-1 text-caption",
        default: "h-12 px-6 py-3 text-body",
        lg: "h-14 px-8 py-4 text-headline",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        data-testid={`swift-button-${variant}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };