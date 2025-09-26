import { describe, test, expect } from 'vitest';
import { generatePlan } from "./generate";
import { WorkoutPlanZ } from "../../shared/workoutSchema";

test.each([
  ["strength",["barbell"]],
  ["conditioning",["kettlebell"]],
  ["mixed",["dumbbell"]],
  ["endurance",[]],
] as const)("plan has items (%s)", (focus, eq) => {
  const plan = generatePlan({ focus, durationMin: 30, intensity: 6, equipment:eq, seed:"TEST" });
  const parsed = WorkoutPlanZ.parse(plan);
  expect(parsed.blocks.every(b => b.items.length > 0)).toBe(true);
  expect(parsed.totalSeconds).toBeGreaterThan(600);
});