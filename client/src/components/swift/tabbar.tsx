import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef, createContext, useContext } from "react";
import { useLocation, Link } from "wouter";

export interface TabBarProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  variant?: "default" | "floating";
}

export interface TabItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
  href: string;
  icon?: React.ReactNode;
  label?: string;
  badge?: string | number;
}

const TabBarContext = createContext<{
  variant?: "default" | "floating";
}>({});

const TabBar = forwardRef<HTMLElement, TabBarProps>(
  ({ className, asChild = false, variant = "default", children, ...props }, ref) => {
    const Comp = asChild ? Slot : "nav";

    const tabBarVariants = {
      default: "bg-surface/95 border-t border-border",
      floating: "bg-surface/95 border border-border rounded-2xl mx-4 mb-4 shadow-card backdrop-blur-xl",
    };

    return (
      <TabBarContext.Provider value={{ variant }}>
        <Comp
          ref={ref}
          className={cn(
            "sticky bottom-0 z-40 w-full transition-all duration-300 ease-in-out",
            "focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2",
            tabBarVariants[variant],
            className
          )}
          role="navigation"
          aria-label="Tab navigation"
          data-testid="swift-tabbar"
          {...props}
        >
          <div className={cn(
            "flex items-center justify-around",
            variant === "default" ? "px-2 py-2" : "px-2 py-3"
          )}>
            {children}
          </div>
        </Comp>
      </TabBarContext.Provider>
    );
  }
);

const TabItem = forwardRef<HTMLAnchorElement, TabItemProps>(
  ({ 
    className, 
    asChild = false, 
    href, 
    icon, 
    label, 
    badge,
    children,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : Link;
    const [location] = useLocation();
    const { variant } = useContext(TabBarContext);
    
    // Check if current route matches this tab
    const isActive = location === href || (href !== "/" && location.startsWith(href));

    return (
      <Comp
        ref={ref}
        to={href}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "hover:bg-muted/50 active:scale-95",
          "min-h-[48px] min-w-[48px]", // Ensure minimum touch target
          isActive 
            ? "bg-primary/10 text-primary" 
            : "text-muted-foreground hover:text-foreground",
          className
        )}
        role="tab"
        aria-selected={isActive}
        aria-current={isActive ? "page" : undefined}
        data-testid={`swift-tab-${href.replace(/\//g, '-')}`}
        {...props}
      >
        <div className="relative">
          {icon && (
            <span 
              className={cn(
                "flex items-center justify-center transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          
          {badge && (
            <span 
              className={cn(
                "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full",
                "bg-destructive text-destructive-foreground text-[10px] font-bold",
                "min-w-[16px] px-1"
              )}
              aria-label={`${badge} notifications`}
              data-testid="swift-tab-badge"
            >
              {typeof badge === 'number' && badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        
        {label && (
          <span 
            className={cn(
              "text-[10px] font-medium leading-none transition-colors truncate max-w-[60px]",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            data-testid="swift-tab-label"
          >
            {label}
          </span>
        )}
        
        {children}
      </Comp>
    );
  }
);

TabBar.displayName = "TabBar";
TabItem.displayName = "TabItem";

export { TabBar, TabItem };