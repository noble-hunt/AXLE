export type Movement = {
  id: string;            // slug
  name: string;
  category: 'olympic_weightlifting'|'powerlifting'|'bb_full_body'|'bb_upper'|'bb_lower'|'gymnastics'|'crossfit'|'aerobic'|'mobility';
  patterns: string[];    // e.g., ['hinge','press'] or ['olympic_snatch']
  equipment: string[];   // e.g., ['barbell']
  modality: 'strength'|'conditioning'|'skill'|'aerobic'|'mobility';
  level: 'beginner'|'intermediate'|'advanced';
  banned_in_main_when_equipment?: boolean;
  aliases?: string[];
};

export type MovementRegistry = Movement[];
