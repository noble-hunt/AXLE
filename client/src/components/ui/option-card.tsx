import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type OptionCardProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
};

export const OptionCard = forwardRef<HTMLButtonElement, OptionCardProps>(
  ({ icon, title, subtitle, description, selected, disabled, onClick, className, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={!!selected}
        className={cn(
          "w-full rounded-2xl border bg-card text-card-foreground shadow-sm",
          "flex flex-row items-start gap-4 p-4 md:p-5",
          "transition-[box-shadow,transform] hover:shadow-md active:scale-[0.995]",
          selected ? "ring-2 ring-primary border-primary/30" : "border-border",
          disabled && "opacity-60 pointer-events-none",
          className
        )}
        {...rest}
      >
        {icon && <div className="shrink-0 h-10 w-10 md:h-12 md:w-12 grid place-items-center rounded-xl bg-muted/40">{icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base md:text-lg font-semibold truncate">{title}</h3>
            {subtitle && <span className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</span>}
          </div>
          {description && (
            <p className="mt-1 text-sm md:text-base leading-snug text-muted-foreground break-words hyphens-auto">
              {description}
            </p>
          )}
        </div>
      </button>
    );
  }
);
OptionCard.displayName = "OptionCard";