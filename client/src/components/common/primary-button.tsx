import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
  type?: "button" | "submit";
  size?: "sm" | "md" | "lg";
}

export function PrimaryButton({ 
  children, 
  onClick, 
  disabled, 
  className, 
  testId,
  type = "button",
  size = "lg"
}: PrimaryButtonProps) {
  const sizeClasses = {
    sm: "py-2 px-4 text-sm",
    md: "py-3 px-5 text-base",
    lg: "py-4 px-6 text-lg"
  };

  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl transition-colors duration-200 flex items-center justify-center gap-2 card-shadow",
        sizeClasses[size],
        className
      )}
      data-testid={testId}
    >
      {children}
    </Button>
  );
}
