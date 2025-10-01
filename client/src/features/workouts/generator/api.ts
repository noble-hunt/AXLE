import { httpJSON } from "@/lib/http";

export async function fetchPreview(input: {
  focus: string;
  durationMin: number;
  equipment: string[];
  intensity: number;
  seed?: string;
}) {
  return httpJSON("/api/workouts/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}