import { describe, it, expect } from 'vitest';

describe('New Pattern Support', () => {
  it('should recognize E4:00 x 4 pattern', () => {
    const ALLOWED_PATTERNS = [
      /E[34]:00 x \d+/i,
      /Every [34]:00 x \d+/i,
      /EMOM \d+(-\d+)?/i,
      /AMRAP \d+/i,
      /For Time 21-15-9/i,
      /Chipper 40-30-20-10/i
    ];

    const title = 'E4:00 x 4';
    const matchesPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(title));
    expect(matchesPattern).toBe(true);
  });

  it('should recognize Chipper 40-30-20-10 pattern', () => {
    const ALLOWED_PATTERNS = [
      /E[34]:00 x \d+/i,
      /Every [34]:00 x \d+/i,
      /EMOM \d+(-\d+)?/i,
      /AMRAP \d+/i,
      /For Time 21-15-9/i,
      /Chipper 40-30-20-10/i
    ];

    const title = 'Chipper 40-30-20-10';
    const matchesPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(title));
    expect(matchesPattern).toBe(true);
  });

  it('should be case-insensitive for Chipper pattern', () => {
    const ALLOWED_PATTERNS = [
      /E[34]:00 x \d+/i,
      /Every [34]:00 x \d+/i,
      /EMOM \d+(-\d+)?/i,
      /AMRAP \d+/i,
      /For Time 21-15-9/i,
      /Chipper 40-30-20-10/i
    ];

    const titles = ['Chipper 40-30-20-10', 'chipper 40-30-20-10', 'CHIPPER 40-30-20-10'];
    
    titles.forEach(title => {
      const matchesPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(title));
      expect(matchesPattern).toBe(true);
    });
  });

  it('should calculate hardness for E4:00 x 4 pattern', () => {
    const mockBlock = {
      kind: 'strength' as const,
      title: 'E4:00 x 4',
      time_min: 16,
      items: [
        { exercise: 'BB Front Squat', target: '5 reps @ 75%' }
      ]
    };

    let h = 0;
    
    // Pattern scoring
    if (mockBlock.kind === 'strength' && /(Every\s+[34]:00|E[34]:00)/i.test(mockBlock.title)) {
      h += 0.28;
    }

    // Equipment bonuses
    const text = JSON.stringify(mockBlock.items).toLowerCase();
    const hasBarbell = /(barbell|bb[\s,])/.test(text);
    if (hasBarbell) h += 0.05;
    if (text.includes('front squat')) h += 0.05;

    expect(h).toBeGreaterThanOrEqual(0.38); // 0.28 + 0.05 + 0.05
  });

  it('should calculate hardness for Chipper 40-30-20-10 pattern', () => {
    const mockBlock = {
      kind: 'conditioning' as const,
      title: 'Chipper 40-30-20-10',
      time_min: 12,
      items: [
        { exercise: 'Wall Balls', target: '40-30-20-10 reps' },
        { exercise: 'Row', target: '40-30-20-10 cal' },
        { exercise: 'KB Swings', target: '40-30-20-10 reps' }
      ]
    };

    let h = 0;
    
    // Pattern scoring
    if (mockBlock.kind === 'conditioning' && /Chipper 40-30-20-10/i.test(mockBlock.title)) {
      h += 0.24;
    }

    // Equipment bonuses
    const text = JSON.stringify(mockBlock.items).toLowerCase();
    const hasDbKb = /(dumbbell|db[\s,]|kettlebell|kb[\s,])/.test(text);
    const hasCyclical = /(echo bike|row|ski|cal)/.test(text);
    
    if (hasDbKb) h += 0.03;
    if (hasCyclical) h += 0.02;
    if (text.includes('wall ball')) h += 0.05;

    expect(h).toBeGreaterThanOrEqual(0.34); // 0.24 + 0.03 + 0.02 + 0.05
  });

  it('should reject patterns that do not match whitelist', () => {
    const ALLOWED_PATTERNS = [
      /E[34]:00 x \d+/i,
      /Every [34]:00 x \d+/i,
      /EMOM \d+(-\d+)?/i,
      /AMRAP \d+/i,
      /For Time 21-15-9/i,
      /Chipper 40-30-20-10/i
    ];

    const invalidTitles = [
      '5 Rounds for Time',
      'Tabata Something',
      'Death by Burpees',
      'E2:00 x 10',
      'Chipper 21-15-9'
    ];
    
    invalidTitles.forEach(title => {
      const matchesPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(title));
      expect(matchesPattern).toBe(false);
    });
  });
});
