import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface BackButtonProps {
  fallbackPath?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
  showText?: boolean;
}

export function BackButton({ 
  fallbackPath = "/", 
  variant = "ghost", 
  size = "sm", 
  className = "",
  children,
  showText = true
}: BackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    // Try to use browser history first
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to provided path or home
      setLocation(fallbackPath);
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleBack}
      className={className}
      data-testid="back-button"
    >
      <ArrowLeft className="w-4 h-4" />
      {showText && (
        <>
          <span className="ml-2">
            {children || "Back"}
          </span>
        </>
      )}
    </Button>
  );
}