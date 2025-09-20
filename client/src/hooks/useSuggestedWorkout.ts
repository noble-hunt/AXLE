import { useState } from "react";
import { useLocation } from "wouter";
import { authFetch } from "@/lib/authFetch";
import type { SuggestedWorkout } from "@shared/schema";

export function useSuggestedWorkout() {
  const [suggestion, setSuggestion] = useState<SuggestedWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const fetchToday = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/suggestions/today");
      const data = await res.json();
      setSuggestion(data);
    } catch (error) {
      console.error("Error fetching today's suggestion:", error);
    } finally {
      setLoading(false);
    }
  };

  const startNow = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/suggestions/generate", { method: "POST" });
      const data = await res.json();
      setSuggestion(data.suggestion);
      // Navigate to the generated workout
      setLocation(`/workout/${data.workout.id}`);
    } catch (error) {
      console.error("Error generating workout:", error);
    } finally {
      setLoading(false);
    }
  };

  return { suggestion, fetchToday, startNow, loading };
}