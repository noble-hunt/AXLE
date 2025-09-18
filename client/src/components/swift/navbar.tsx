import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";

export interface NavBarProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  variant?: "default" | "transparent" | "blur";
}

export interface NavBarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export interface NavBarTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  asChild?: boolean;
}

export interface NavBarActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const NavBar = forwardRef<HTMLElement, NavBarProps>(
  ({ className, asChild = false, variant = "default", ...props }, ref) => {
    const Comp = asChild ? Slot : "nav";

    const navVariants = {
      default: "bg-surface/95 border-b border-border shadow-soft",
      transparent: "bg-transparent",
      blur: "bg-surface/80 backdrop-blur-xl border-b border-border/50",
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300 ease-in-out",
          "focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2",
          navVariants[variant],
          className
        )}
        role="navigation"
        aria-label="Main navigation"
        data-testid="swift-navbar"
        {...props}
      />
    );
  }
);

const NavBarContent = forwardRef<HTMLDivElement, NavBarContentProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          "flex h-16 items-center justify-between px-4 sm:px-6",
          className
        )}
        data-testid="swift-navbar-content"
        {...props}
      />
    );
  }
);

const NavBarTitle = forwardRef<HTMLHeadingElement, NavBarTitleProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "h1";
    return (
      <Comp
        ref={ref}
        className={cn(
          "text-headline font-bold text-foreground truncate",
          className
        )}
        data-testid="swift-navbar-title"
        {...props}
      />
    );
  }
);

const NavBarActions = forwardRef<HTMLDivElement, NavBarActionsProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          "flex items-center gap-2",
          className
        )}
        data-testid="swift-navbar-actions"
        {...props}
      />
    );
  }
);

NavBar.displayName = "NavBar";
NavBarContent.displayName = "NavBarContent";
NavBarTitle.displayName = "NavBarTitle";
NavBarActions.displayName = "NavBarActions";

export { NavBar, NavBarContent, NavBarTitle, NavBarActions };