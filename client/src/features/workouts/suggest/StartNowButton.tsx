import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/swift/button";
import { Target } from "lucide-react";
import { startSuggestion } from "./api";
import { toast } from "@/hooks/use-toast";

export function StartNowButton() {
  const [, navigate] = useLocation();
  const [isStarting, setIsStarting] = useState(false);
  
  const handleClick = async () => {
    setIsStarting(true);
    try {
      const id = await startSuggestion();
      if (!id) throw new Error("No workout ID returned");
      navigate(`/workout/${id}`);
    } catch (e: any) {
      toast({ 
        title: "Could not start workout", 
        description: e?.message ?? "Unknown error", 
        variant: "destructive" 
      });
    } finally {
      setIsStarting(false);
    }
  };
  
  return (
    <Button
      data-testid="button-start-now"
      onClick={handleClick}
      disabled={isStarting}
      className="w-full"
    >
      <Target className="w-4 h-4 mr-2" />
      {isStarting ? 'Starting...' : 'Start Now'}
    </Button>
  );
}