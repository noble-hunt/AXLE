export type StyleKey =
  | "crossfit" | "olympic_weightlifting" | "powerlifting"
  | "bb_full_body" | "bb_upper" | "bb_lower"
  | "aerobic" | "endurance" | "conditioning"
  | "strength" | "mixed"
  | "gymnastics" | "mobility";

export type StyleSpec = {
  key: StyleKey;
  // canonical movement patterns this style should primarily draw from
  allowPatterns: string[];        // e.g., ["cyclical","run","row","bike","ski","swim","jump_rope"]
  // patterns that must NOT appear in mains for this style
  banMainPatterns?: string[];     // e.g., ["olympic_snatch","olympic_cleanjerk","thruster","kb_snatch","deadlift"]
  // patterns that must appear at least once across mains
  requirePatterns?: string[];     // e.g., olympic requires both snatch & clean&jerk
  // ratio constraints on time-in-style
  minCyclicalRatio?: number;      // e.g., endurance >= 0.8 of total block minutes must be cardio/cyclical
  maxLoadedRatio?: number;        // e.g., endurance <= 0.2 of main minutes may be loaded
  // default floors
  hardnessFloor?: number;         // style-specific floor
};

// NOTE: keep these pattern strings consistent with movementService registry patterns.
// Use both generic ("cyclical","cardio") and specific synonyms to be robust.
export const STYLE_SPECS: Record<StyleKey, StyleSpec> = {
  endurance: {
    key: "endurance",
    allowPatterns: ["cyclical","cardio","run","row","bike","erg","ski","swim","jump_rope"],
    banMainPatterns: ["olympic_snatch","olympic_cleanjerk","thruster","kb_snatch","clean","jerk","deadlift","front_squat","back_squat","bench_press","hinge","squat","press","pull"],
    minCyclicalRatio: 0.8,
    maxLoadedRatio: 0.2,
    hardnessFloor: 0.80,
  },
  aerobic: {
    key: "aerobic",
    allowPatterns: ["cyclical","cardio","run","row","bike","erg","ski","swim","jump_rope"],
    banMainPatterns: ["olympic_snatch","olympic_cleanjerk","thruster","kb_snatch","deadlift","front_squat","back_squat","bench_press"],
    minCyclicalRatio: 0.9,
    maxLoadedRatio: 0.1,
    hardnessFloor: 0.75,
  },
  conditioning: {
    key: "conditioning",
    allowPatterns: ["cardio","cyclical","burpee","circuit","amrap","emom","for_time"],
    banMainPatterns: [],
    hardnessFloor: 0.85,
  },
  strength: {
    key: "strength",
    allowPatterns: ["squat","press","pull","hinge","single_leg","upper_pull","upper_press"],
    banMainPatterns: ["olympic_snatch","olympic_cleanjerk"],
    hardnessFloor: 0.85,
  },
  mixed: {
    key: "mixed",
    allowPatterns: ["squat","press","pull","hinge","cardio","cyclical","amrap","emom","for_time"],
    banMainPatterns: [],
    hardnessFloor: 0.85,
  },
  olympic_weightlifting: {
    key: "olympic_weightlifting",
    allowPatterns: ["olympic_snatch","olympic_cleanjerk","olympic_pull","front_squat","overhead_squat"],
    requirePatterns: ["olympic_snatch","olympic_cleanjerk"],
    hardnessFloor: 0.85,
  },
  powerlifting: {
    key: "powerlifting",
    allowPatterns: ["back_squat","front_squat","bench_press","deadlift","hinge","press","pull"],
    hardnessFloor: 0.85,
  },
  bb_full_body: {
    key: "bb_full_body",
    allowPatterns: ["hypertrophy","squat","press","pull","single_leg","upper_pull","upper_press","posterior_chain"],
    hardnessFloor: 0.8,
  },
  bb_upper: {
    key: "bb_upper",
    allowPatterns: ["upper_pull","upper_press","hypertrophy"],
    hardnessFloor: 0.8,
  },
  bb_lower: {
    key: "bb_lower",
    allowPatterns: ["squat","single_leg","posterior_chain","hypertrophy"],
    hardnessFloor: 0.8,
  },
  gymnastics: {
    key: "gymnastics",
    allowPatterns: ["gym_pull","gym_push","core","support_hold","static_hold","skill"],
    hardnessFloor: 0.8,
  },
  mobility: {
    key: "mobility",
    allowPatterns: ["mobility","stretching","recovery","breathing"],
    hardnessFloor: 0.6,
  },
  crossfit: {
    key: "crossfit",
    allowPatterns: ["cardio","cyclical","amrap","emom","for_time","hinge","squat","press","pull","olympic_snatch","olympic_cleanjerk"],
    hardnessFloor: 0.85,
  },
};
