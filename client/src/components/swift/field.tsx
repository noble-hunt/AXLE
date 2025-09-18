import { cn } from "@/lib/utils";
import { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  assistiveText?: string;
  error?: string;
  required?: boolean;
  variant?: "default" | "filled";
}

const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ 
    className, 
    label, 
    assistiveText, 
    error, 
    required,
    variant = "default", 
    id,
    ...props 
  }, ref) => {
    const fieldId = id || useId();
    const assistiveId = `${fieldId}-assistive`;
    const errorId = `${fieldId}-error`;

    const inputVariants = {
      default: "bg-surface border border-border focus:border-primary focus:ring-primary/20",
      filled: "bg-muted border border-transparent focus:border-primary focus:ring-primary/20 focus:bg-surface",
    };

    return (
      <div className="space-y-2" data-testid="swift-field">
        {label && (
          <label 
            htmlFor={fieldId}
            className={cn(
              "text-body font-medium text-foreground",
              required && "after:content-['*'] after:ml-0.5 after:text-destructive"
            )}
            data-testid="swift-field-label"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            className={cn(
              "w-full h-12 px-4 py-3 rounded-xl text-body text-foreground placeholder:text-muted-foreground",
              "transition-all duration-200 ease-in-out",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              "disabled:cursor-not-allowed disabled:opacity-50",
              inputVariants[variant],
              error && "border-destructive focus:border-destructive focus:ring-destructive/20",
              className
            )}
            aria-describedby={cn(
              assistiveText && assistiveId,
              error && errorId
            )}
            aria-invalid={!!error}
            required={required}
            data-testid="swift-field-input"
            {...props}
          />
          
          {error && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
            </div>
          )}
        </div>

        {(assistiveText || error) && (
          <div className="space-y-1">
            {error ? (
              <p 
                id={errorId}
                className="text-caption text-destructive flex items-center gap-1"
                role="alert"
                data-testid="swift-field-error"
              >
                {error}
              </p>
            ) : assistiveText ? (
              <p 
                id={assistiveId}
                className="text-caption text-muted-foreground"
                data-testid="swift-field-assistive"
              >
                {assistiveText}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);

Field.displayName = "Field";

export { Field };