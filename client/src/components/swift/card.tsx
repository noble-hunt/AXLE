import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  variant?: "default" | "elevated" | "filled";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild = false, variant = "default", ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    const cardVariants = {
      default: "bg-card border border-border shadow-soft",
      elevated: "bg-card shadow-card border-0",
      filled: "bg-muted shadow-soft border-0",
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          "rounded-xl p-7 transition-all duration-300 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          cardVariants[variant],
          className
        )}
        data-testid="swift-card"
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

export { Card };