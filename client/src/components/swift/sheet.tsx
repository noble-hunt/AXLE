import { cn } from "@/lib/utils";
import { forwardRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "default" | "fullscreen" | "compact";
}

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  showCloseButton?: boolean;
}

export interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface SheetTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export interface SheetDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export interface SheetFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const Sheet = forwardRef<HTMLDivElement, SheetProps>(
  ({ open = false, onOpenChange, variant = "default", children, ...props }, ref) => {
    // Handle escape key and focus management
    useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape" && open) {
          onOpenChange?.(false);
        }
      };

      if (open) {
        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";
        
        // Set initial focus on the dialog
        setTimeout(() => {
          const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
          if (dialog) {
            dialog.focus();
          }
        }, 100);
      }

      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      };
    }, [open, onOpenChange]);

    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {open && (
          <div
            ref={ref}
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            data-testid="swift-sheet"
            {...props}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => onOpenChange?.(false)}
              aria-hidden="true"
            />

            {/* Sheet content */}
            <motion.div
              initial={
                variant === "fullscreen"
                  ? { opacity: 0, scale: 0.95 }
                  : { opacity: 0, y: "100%" }
              }
              animate={
                variant === "fullscreen"
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 1, y: 0 }
              }
              exit={
                variant === "fullscreen"
                  ? { opacity: 0, scale: 0.95 }
                  : { opacity: 0, y: "100%" }
              }
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300,
              }}
              className={cn(
                "relative flex flex-col bg-surface border border-border shadow-2xl",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                variant === "fullscreen" && "h-full w-full rounded-none",
                variant === "default" && "max-h-[85vh] w-full max-w-sm rounded-t-2xl sm:rounded-xl",
                variant === "compact" && "max-h-[50vh] w-full max-w-xs rounded-t-2xl sm:rounded-xl"
              )}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  // Simple focus trap - in a real implementation you'd want a more robust solution
                  const focusableElements = e.currentTarget.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                  );
                  const firstElement = focusableElements[0] as HTMLElement;
                  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
                  
                  if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                  } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                  }
                }
              }}
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    );
  }
);

const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, onClose, showCloseButton = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 overflow-auto p-6", className)}
        data-testid="swift-sheet-content"
        {...props}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "absolute right-4 top-4 rounded-lg p-2 text-muted-foreground",
              "hover:text-foreground hover:bg-muted",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "transition-colors duration-200"
            )}
            aria-label="Close"
            data-testid="swift-sheet-close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    );
  }
);

const SheetHeader = forwardRef<HTMLDivElement, SheetHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-2 text-center sm:text-left px-6 pt-6", className)}
        data-testid="swift-sheet-header"
        {...props}
      />
    );
  }
);

const SheetTitle = forwardRef<HTMLHeadingElement, SheetTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={cn("text-title font-bold text-foreground", className)}
        data-testid="swift-sheet-title"
        {...props}
      />
    );
  }
);

const SheetDescription = forwardRef<HTMLParagraphElement, SheetDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-body text-muted-foreground", className)}
        data-testid="swift-sheet-description"
        {...props}
      />
    );
  }
);

const SheetFooter = forwardRef<HTMLDivElement, SheetFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 pb-6 pt-4 gap-2",
          className
        )}
        data-testid="swift-sheet-footer"
        {...props}
      />
    );
  }
);

Sheet.displayName = "Sheet";
SheetContent.displayName = "SheetContent";
SheetHeader.displayName = "SheetHeader";
SheetTitle.displayName = "SheetTitle";
SheetDescription.displayName = "SheetDescription";
SheetFooter.displayName = "SheetFooter";

export { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter 
};