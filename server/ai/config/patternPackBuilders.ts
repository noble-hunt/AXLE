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

// TODO: If needed later, create builders for powerlifting, crossfit, etc.
// For now we only wire olympic here and default to existing packs for others.
