export const SUPPORTED_STYLES = [
  'crossfit',
  'olympic_weightlifting',
  'powerlifting',
  'bb_full_body',
  'bb_upper',
  'bb_lower',
  'aerobic',
  'conditioning',
  'strength',
  'endurance',
  'gymnastics',
  'mobility',
  'mixed',
] as const;

export type SupportedStyle = typeof SUPPORTED_STYLES[number];

export function normalizeStyle(input: any): SupportedStyle {
  const raw = String(input ?? '').trim().toLowerCase();
  const map: Record<string, SupportedStyle> = {
    crossfit: 'crossfit',
    cf: 'crossfit',
    oly: 'olympic_weightlifting',
    olympic: 'olympic_weightlifting',
    olympic_weightlifting: 'olympic_weightlifting',
    powerlifting: 'powerlifting',
    pl: 'powerlifting',
    bbfull: 'bb_full_body',
    'bb full body': 'bb_full_body',
    bb_full_body: 'bb_full_body',
    bb_upper: 'bb_upper',
    bb_lower: 'bb_lower',
    aerobic: 'aerobic',
    conditioning: 'conditioning',
    strength: 'strength',
    endurance: 'endurance',
    gymnastics: 'gymnastics',
    mobility: 'mobility',
    mixed: 'mixed',
  };

  if (map[raw]) return map[raw];

  // Some common typos/variants
  if (raw.includes('olympic')) return 'olympic_weightlifting';
  if (raw === 'bb' || raw.includes('bodybuilding')) return 'bb_full_body';

  // Default: mixed (but NEVER 'none')
  return 'mixed';
}
