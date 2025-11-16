import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef, createContext, useContext, useRef, useEffect } from "react";

export interface SegmentedControlProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

export interface SegmentProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  asChild?: boolean;
}

const SegmentedControlContext = createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  segments?: string[];
  registerSegment?: (value: string) => void;
  unregisterSegment?: (value: string) => void;
}>({});

const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ className, value, onValueChange, disabled, children, ...props }, ref) => {
    const segmentsRef = useRef<string[]>([]);
    
    const registerSegment = (segmentValue: string) => {
      if (!segmentsRef.current.includes(segmentValue)) {
        segmentsRef.current.push(segmentValue);
      }
    };

    const unregisterSegment = (segmentValue: string) => {
      segmentsRef.current = segmentsRef.current.filter(v => v !== segmentValue);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const segments = segmentsRef.current;
      const currentIndex = segments.indexOf(value || "");
      
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : segments.length - 1;
          onValueChange?.(segments[prevIndex]);
          break;
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          const nextIndex = currentIndex < segments.length - 1 ? currentIndex + 1 : 0;
          onValueChange?.(segments[nextIndex]);
          break;
        case "Home":
          event.preventDefault();
          onValueChange?.(segments[0]);
          break;
        case "End":
          event.preventDefault();
          onValueChange?.(segments[segments.length - 1]);
          break;
      }
    };

    return (
      <SegmentedControlContext.Provider value={{ 
        value, 
        onValueChange, 
        disabled, 
        segments: segmentsRef.current,
        registerSegment,
        unregisterSegment
      }}>
        <div
          ref={ref}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground shadow-soft gap-1",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            className
          )}
          role="radiogroup"
          onKeyDown={handleKeyDown}
          data-testid="swift-segmented-control"
          {...props}
        >
          {children}
        </div>
      </SegmentedControlContext.Provider>
    );
  }
);

const Segment = forwardRef<HTMLButtonElement, SegmentProps>(
  ({ className, value, children, disabled: segmentDisabled, onClick, asChild = false, ...props }, ref) => {
    const { 
      value: selectedValue, 
      onValueChange, 
      disabled: controlDisabled,
      registerSegment,
      unregisterSegment
    } = useContext(SegmentedControlContext);
    const isSelected = value === selectedValue;
    const isDisabled = controlDisabled || segmentDisabled;

    useEffect(() => {
      registerSegment?.(value);
      return () => unregisterSegment?.(value);
    }, [value, registerSegment, unregisterSegment]);

    const Comp = asChild ? Slot : "button";

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled && onValueChange) {
        onValueChange(value);
      }
      onClick?.(event);
    };

    return (
      <Comp
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isSelected}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-body font-medium transition-all duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          isSelected
            ? "bg-surface text-foreground shadow-soft"
            : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
          className
        )}
        onClick={handleClick}
        data-testid={`swift-segment-${value}`}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

SegmentedControl.displayName = "SegmentedControl";
Segment.displayName = "Segment";

export { SegmentedControl, Segment };