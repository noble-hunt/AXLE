import { useLocation } from "wouter";
import { startSuggestion } from "./api";
import { toast } from "@/hooks/use-toast";

export function StartNowButton() {
  const [, navigate] = useLocation();
  
  return (
    <button
      className="btn btn-primary w-full"
      data-testid="button-start-now"
      onClick={async () => {
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
        }
      }}
    >
      Start Now
    </button>
  );
}