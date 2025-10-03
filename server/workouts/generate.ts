import { MOVEMENTS } from "./movements";
import { WorkoutPlan, WorkoutPlanZ, BlockZ } from "../../shared/workoutSchema";
import { mulberry32, strSeed } from "./rand";
import { z } from "zod";

type Input = {
  focus: WorkoutPlan["focus"];
  durationMin: number;
  intensity: number;         // 1..10
  equipment: string[];       // ["dumbbell","kettlebell"] etc. may be empty
  seed: string;              // hex/word
};

function pick<T>(rng: () => number, arr: T[]) { 
  return arr[Math.floor(rng() * arr.length)]; 
}

// Canonical equipment alias mapping
const EQUIPMENT_ALIASES: Record<string, string> = {
  // Plural forms
  'dumbbells': 'dumbbell',
  'kettlebells': 'kettlebell',
  'barbells': 'barbell',
  // Underscore variants
  'pull_up_bar': 'pullup-bar',
  'pullup_bar': 'pullup-bar',
  'dip_bar': 'dip-bar',
  // Already canonical (pass-through)
  'bodyweight': 'bodyweight',
  'dumbbell': 'dumbbell',
  'kettlebell': 'kettlebell',
  'barbell': 'barbell',
  'pullup-bar': 'pullup-bar',
  'dip-bar': 'dip-bar',
};

function normalizeEquipment(equipment: string): string {
  const lower = equipment.toLowerCase();
  return EQUIPMENT_ALIASES[lower] || lower;
}

function filterByEquipment(allowed: string[]) {
  const normalized = allowed.map(normalizeEquipment);
  const set = new Set(normalized.length ? normalized : ["bodyweight"]);
  return MOVEMENTS.filter(m => m.equipment.some(e => set.has(e)));
}

function chooseByTags(pool: ReturnType<typeof filterByEquipment>, tags: string[], rng: () => number, n: number) {
  const cands = pool.filter(m => tags.some(t => m.tags.includes(t)));
  const out: typeof pool = [];
  const bag = [...cands];
  for (let i = 0; i < n && bag.length; i++) {
    out.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
  }
  return out.length ? out : pool.slice(0, Math.max(1, n));
}

// map intensity to prescriptions
function doseStrength(intensity: number) {
  // simple mapping
  if (intensity >= 8) return { sets: 5, reps: 3, restSec: 150, load: "RPE 9" };
  if (intensity >= 6) return { sets: 5, reps: 5, restSec: 120, load: "RPE 8" };
  if (intensity >= 4) return { sets: 4, reps: 8, restSec: 90, load: "RPE 7" };
  return { sets: 3, reps: 10, restSec: 60, load: "RPE 6" };
}

function doseConditioning(intensity: number) {
  // 30–60s work, 10–30s rest
  const work = intensity >= 8 ? 45 : intensity >= 6 ? 40 : 30;
  const rest = intensity >= 8 ? 15 : intensity >= 6 ? 20 : 30;
  return { sets: 10, seconds: work, restSec: rest };
}

export function generatePlan(input: Input): WorkoutPlan {
  const seedN = strSeed(input.seed || `${input.focus}:${input.durationMin}:${input.intensity}:${input.equipment.join(",")}`);
  const rng = mulberry32(seedN);
  const pool = filterByEquipment(input.equipment);

  // split duration: 20% warmup, 70% main, 10% cooldown
  const totalSec = input.durationMin * 60;
  const warmSec = Math.max(300, Math.round(totalSec * 0.2));
  const mainSec = Math.max(600, Math.round(totalSec * 0.7));
  const coolSec = Math.max(180, totalSec - warmSec - mainSec);

  const blocks: z.infer<typeof BlockZ>[] = [];

  // WARMUP
  const wuMoves = chooseByTags(pool, ["warmup", "core", "mobility"], rng, 2);
  blocks.push({
    key: "warmup",
    title: "Warm-up",
    targetSeconds: warmSec,
    style: "interval",
    items: wuMoves.map(m => ({
      movementId: m.id,
      name: m.name,
      prescription: { 
        type: "time" as const, 
        sets: 1, 
        seconds: Math.round(warmSec / wuMoves.length), 
        load: "bodyweight", 
        restSec: 0 
      }
    }))
  });

  // MAIN by focus
  if (input.focus === "strength") {
    const picks = chooseByTags(pool, ["squat", "hinge", "push", "pull"], rng, 2);
    const dose = doseStrength(input.intensity);
    blocks.push({
      key: "main",
      title: "Main Strength",
      targetSeconds: mainSec,
      style: "straight-sets",
      items: picks.map(m => ({
        movementId: m.id,
        name: m.name,
        prescription: { 
          type: "reps" as const, 
          sets: dose.sets, 
          reps: dose.reps!, 
          restSec: dose.restSec, 
          load: dose.load 
        }
      }))
    });
  } else if (input.focus === "conditioning") {
    const picks = chooseByTags(pool, ["conditioning", "full", "hinge", "squat", "push", "pull"], rng, 4);
    const dose = doseConditioning(input.intensity);
    blocks.push({
      key: "main",
      title: "MetCon",
      targetSeconds: mainSec,
      style: "amrap",
      items: picks.map(m => ({
        movementId: m.id,
        name: m.name,
        prescription: { 
          type: "time" as const, 
          sets: dose.sets, 
          seconds: dose.seconds!, 
          restSec: dose.restSec, 
          load: m.equipment.includes("bodyweight") ? "bodyweight" : "moderate" 
        }
      }))
    });
  } else if (input.focus === "endurance") {
    const picks = chooseByTags(pool, ["mono", "conditioning", "lower"], rng, 1);
    blocks.push({
      key: "main",
      title: "Intervals",
      targetSeconds: mainSec,
      style: "interval",
      items: picks.map(m => ({
        movementId: m.id, 
        name: m.name,
        prescription: { 
          type: "time" as const, 
          sets: 8, 
          seconds: 60, 
          restSec: 30, 
          load: "sustainable" 
        }
      })),
    });
  } else { // mixed
    const sPick = chooseByTags(pool, ["squat", "hinge", "push", "pull"], rng, 1);
    const cPick = chooseByTags(pool, ["conditioning", "full"], rng, 2);
    const sd = doseStrength(input.intensity);
    const cd = doseConditioning(input.intensity);
    blocks.push({
      key: "main",
      title: "Mixed",
      targetSeconds: mainSec,
      style: "circuit",
      items: [
        ...sPick.map(m => ({ 
          movementId: m.id, 
          name: m.name, 
          prescription: { 
            type: "reps" as const, 
            sets: sd.sets, 
            reps: sd.reps!, 
            restSec: sd.restSec, 
            load: sd.load 
          }
        })),
        ...cPick.map(m => ({ 
          movementId: m.id, 
          name: m.name, 
          prescription: { 
            type: "time" as const, 
            sets: cd.sets, 
            seconds: cd.seconds!, 
            restSec: cd.restSec,
            load: "moderate" 
          }
        })),
      ]
    });
  }

  // COOLDOWN
  const cdMoves = chooseByTags(pool, ["core", "warmup", "mobility"], rng, 1);
  blocks.push({
    key: "cooldown",
    title: "Cool-down",
    targetSeconds: coolSec,
    style: "interval",
    items: cdMoves.map(m => ({
      movementId: m.id,
      name: m.name,
      prescription: { 
        type: "time" as const, 
        sets: 1, 
        seconds: coolSec, 
        restSec: 0, 
        load: "easy" 
      }
    }))
  });

  const plan: WorkoutPlan = {
    seed: input.seed,
    focus: input.focus,
    durationMin: input.durationMin,
    intensity: input.intensity,
    equipment: input.equipment.length ? input.equipment : ["bodyweight"],
    blocks,
    totalSeconds: warmSec + mainSec + coolSec,
    summary: `${input.focus} session • ${input.durationMin}min • intensity ${input.intensity}/10`,
    version: 1,
  };

  return WorkoutPlanZ.parse(plan);
}