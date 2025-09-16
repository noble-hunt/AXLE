import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionTitleProps {
  title: string;
  action?: ReactNode;
  subtitle?: string;
  className?: string;
}

export function SectionTitle({ title, action, subtitle, className }: SectionTitleProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
