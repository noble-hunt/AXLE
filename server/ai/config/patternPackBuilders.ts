// Duration-aware pattern pack builders.
// Each builder returns the same shape as the old static pack.
export type PatternBlock = {
  pattern: 'E2:00x' | 'E2:30x' | 'E3:00x' | 'EMOM' | 'AMRAP' | 'FOR_TIME_21_15_9' | 'CHIPPER_40_30_20_10' | 'INTERVALS' | 'STEADY' | 'MOBILITY_QUALITY';
  minutes: number;        // target minutes for this block
  kind: 'strength' | 'conditioning' | 'skill' | 'aerobic' | 'mobility';  // block type
  select: {
    categories: string[];
    patterns: string[];
    modality: ('strength' | 'conditioning' | 'skill' | 'aerobic' | 'mobility')[];
    items: number;
    requireLoaded?: boolean;
  };
  title?: string;         // optional explicit title
  notes?: string;         // optional coaching notes/scheme
};
export type PatternPack = {
  name: string;
  warmupMin: number;
  cooldownMin: number;
  hardnessFloor: number;
  mainBlocks: PatternBlock[];
  requiredPatterns?: string[];   // patterns that must appear across mains
};

// Helper to clamp a value within bounds
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Helper to pick the best available cardio modality from equipment
function pickCyclical(equipment: string[] = []): { name: string; patterns: string[] } {
  const eq = (equipment || []).map(e => String(e).toLowerCase());
  if (eq.includes('rower')) return { name: 'Row', patterns: ['row', 'erg', 'cyclical'] };
  if (eq.includes('bike') || eq.includes('air_bike') || eq.includes('assault_bike'))
    return { name: 'Bike', patterns: ['bike', 'erg', 'cyclical'] };
  if (eq.includes('treadmill')) return { name: 'Run', patterns: ['run', 'cyclical'] };
  if (eq.includes('ski_erg')) return { name: 'Ski Erg', patterns: ['ski', 'erg', 'cyclical'] };
  // fallback
  return { name: 'Jump Rope', patterns: ['jump_rope', 'cyclical'] };
}

// ---- OLYMPIC WEIGHTLIFTING ----
export function buildOlympicPack(totalMin: number): PatternPack {
  // Default mins; compress if budget is tight
  const warmup = totalMin >= 35 ? 8 : 6;
  const cooldown = totalMin >= 35 ? 6 : 4;
  const budgetForMains = Math.max(0, totalMin - warmup - cooldown);

  // Always require both olympic patterns overall
  const requiredPatterns = ["olympic_snatch", "olympic_cleanjerk"];

  // Two separate mains if we have the time
  if (budgetForMains >= 24) {
    const per = Math.floor(budgetForMains / 2); // split mains
    return {
      name: "Olympic Weightlifting",
      warmupMin: warmup,
      cooldownMin: cooldown,
      hardnessFloor: 0.85,
      requiredPatterns,
      mainBlocks: [
        {
          pattern: "E2:00x",
          minutes: clamp(per, 10, 16), // 5–8 rounds typical
          kind: 'strength',
          select: {
            categories: ["olympic_weightlifting"],
            patterns: ["olympic_snatch"],  // Guarantee snatch pattern
            modality: ["strength", "skill"],
            items: 1,
            requireLoaded: true
          },
          title: "Every 2:00 — Snatch Complex",
        },
        {
          pattern: "E2:00x",
          minutes: clamp(per, 10, 16),
          kind: 'strength',
          select: {
            categories: ["olympic_weightlifting"],
            patterns: ["olympic_cleanjerk"],  // Guarantee C&J pattern
            modality: ["strength", "skill"],
            items: 1,
            requireLoaded: true
          },
          title: "Every 2:00 — Clean & Jerk Complex",
        },
      ],
    };
  }

  // Otherwise: one alternating main (both patterns present)
  const altMin = clamp(budgetForMains, 10, Math.max(10, budgetForMains));
  return {
    name: "Olympic Weightlifting",
    warmupMin: warmup,
    cooldownMin: cooldown,
    hardnessFloor: 0.85,
    requiredPatterns,
    mainBlocks: [
      {
        pattern: "E2:00x",        // Combined block for both lifts when time is limited
        minutes: altMin,          // ~10–16 min based on budget
        kind: 'strength',
        select: {
          categories: ["olympic_weightlifting"],
          patterns: ["olympic_snatch", "olympic_cleanjerk"],  // Both required patterns
          modality: ["strength", "skill"],
          items: 2,  // Must pick 2 items to guarantee both patterns
          requireLoaded: true
        },
        title: "Every 2:00 — Snatch / Clean & Jerk",
      },
    ],
  };
}

// ---- ENDURANCE ----
export function buildEndurancePack(totalMin: number, requestedIntensity = 6, equipment?: string[]): PatternPack {
  const warmup = totalMin >= 40 ? 8 : totalMin >= 30 ? 6 : 5;
  const cooldown = totalMin >= 40 ? 6 : totalMin >= 30 ? 4 : 3;
  const budget = Math.max(10, totalMin - warmup - cooldown);

  // Pick the best available cardio modality
  const mod = pickCyclical(equipment);

  // Translate 1–10 to zones/structure:
  // 4–5 → steady Z2/Z3, 6–7 → tempo / cruise intervals, 8+ → VO2 short repeats.
  const i = Math.max(1, Math.min(10, requestedIntensity));
  const isSteady = i <= 5;
  const isTempo = i >= 6 && i <= 7;
  const isVO2   = i >= 8;

  const mainBlocks: PatternBlock[] = [];

  if (isSteady) {
    // One steady block - continuous effort
    mainBlocks.push({
      pattern: "STEADY",
      minutes: budget,
      kind: 'aerobic',
      select: {
        categories: ["endurance","aerobic"],
        patterns: mod.patterns,
        modality: ["aerobic"],
        items: 1
      },
      title: `Steady ${mod.name} Z2–Z3`,
      notes: `Steady ${budget}:00 continuous @ Z2–Z3. Maintain conversational pace, nasal breathing.`,
    });
  } else if (isTempo) {
    // Cruise intervals e.g., 3 x 6' @ Z3/4 with 2' easy
    const rounds = budget >= 20 ? 4 : 3;
    const workMin = Math.floor((budget * 0.7) / rounds);
    const restMin = Math.floor((budget * 0.3) / rounds);
    mainBlocks.push({
      pattern: "INTERVALS",
      minutes: budget,
      kind: 'aerobic',
      select: {
        categories: ["endurance","aerobic"],
        patterns: mod.patterns,
        modality: ["aerobic"],
        items: 1
      },
      title: `Cruise Intervals ${mod.name} Z3–Z4`,
      notes: `${rounds} x ${workMin}:00 @ Z3–Z4, ${restMin}:00 easy. Comfortably hard, sustainable effort.`,
    });
  } else if (isVO2) {
    // VO2 repeats e.g., 10 x 1' hard / 1' easy
    const rounds = budget >= 20 ? 12 : budget >= 16 ? 10 : 8;
    const workSec = 60;
    const restSec = Math.floor((budget * 60 - rounds * workSec) / rounds);
    mainBlocks.push({
      pattern: "VO2",
      minutes: budget,
      kind: 'aerobic',
      select: {
        categories: ["endurance","aerobic"],
        patterns: mod.patterns,
        modality: ["aerobic"],
        items: 1
      },
      title: `VO2 Repeats ${mod.name} Z4–Z5`,
      notes: `${rounds} x ${workSec}s ON / ${restSec}s OFF @ Z4–Z5. Hard effort, stay smooth. Pace by HR/respiration, not all-out.`,
    });
  }

  return {
    name: "Endurance",
    warmupMin: warmup,
    cooldownMin: cooldown,
    hardnessFloor: 0.50,  // Lower floor for cardio-only workouts (no loaded movements)
    mainBlocks,
  };
}

// TODO: If needed later, create builders for powerlifting, crossfit, etc.
// For now we only wire olympic and endurance here and default to existing packs for others.
