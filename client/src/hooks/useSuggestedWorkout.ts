import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/authFetch";
import { useAppStore } from "@/store/useAppStore";
import type { SuggestedWorkout } from "@shared/schema";

export function useSuggestedWorkout() {
  const [suggestion, setSuggestion] = useState<SuggestedWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAppStore();

  const fetchToday = async () => {
    if (!isAuthenticated) {
      setSuggestion(null);
      return;
    }
    
    setLoading(true);
    try {
      const res = await authFetch("/api/suggestions/today");
      if (res.ok) {
        const data = await res.json();
        setSuggestion(data);
      } else {
        console.error("Failed to fetch suggestion:", res.status);
        setSuggestion(null);
      }
    } catch (error) {
      console.error("Error fetching today's suggestion:", error);
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  };

  // Automatically fetch today's suggestion when authenticated
  useEffect(() => {
    fetchToday();
  }, [isAuthenticated]);

  const startNow = async () => {
    if (!suggestion) return;
    
    setIsGenerating(true);
    try {
      const res = await authFetch("/api/suggestions/generate", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suggestion)
      });
      if (res.ok) {
        const data = await res.json();
        // Navigate to the generated workout
        setLocation(`/workout/${data.workout.id}`);
      } else {
        console.error("Failed to start workout:", res.status);
      }
    } catch (error) {
      console.error("Error generating workout:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await authFetch("/api/suggestions/generate", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestion(data.suggestion);
      } else {
        console.error("Failed to regenerate suggestion:", res.status);
      }
    } catch (error) {
      console.error("Error regenerating suggestion:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return { 
    suggestion, 
    isLoading: loading, 
    isGenerating,
    fetchToday, 
    startNow, 
    regenerate
  };
}