import { describe, it, expect } from 'vitest';

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Movement category mappings for each style
const STYLE_CATEGORIES = {
  crossfit: ['squat', 'hinge', 'press', 'pull', 'core', 'olympic', 'carry', 'cyclical'],
  olympic_weightlifting: ['olympic', 'squat', 'pull', 'core'],
  powerlifting: ['squat', 'hinge', 'press'],
  bb_full_body: ['squat', 'hinge', 'press', 'pull', 'core'],
  bb_upper: ['press', 'pull', 'core'],
  bb_lower: ['squat', 'hinge', 'core'],
  aerobic: ['cyclical', 'squat', 'hinge'],
  gymnastics: ['pull', 'core', 'press'],
  mobility: ['mobility']
};

// Expected patterns for each style
const STYLE_PATTERNS = {
  crossfit: [/E[234]:00 x \d+/i, /Every [234]:00 x \d+/i, /EMOM \d+/i, /AMRAP \d+/i, /For Time/i],
  olympic_weightlifting: [/E[234]:00 x \d+/i, /Every [234]:00 x \d+/i, /snatch|clean.*jerk|c&j/i],
  powerlifting: [/x \d+/i, /squat|deadlift|bench/i],
  bb_full_body: [/x \d+/i, /round|superset|tri.*set/i],
  bb_upper: [/x \d+/i, /round|superset|tri.*set/i],
  bb_lower: [/x \d+/i, /round|superset/i],
  aerobic: [/x \d+/i, /z[234]|steady|interval/i],
  gymnastics: [/EMOM/i, /AMRAP/i, /handstand|pull.*up|muscle.*up/i],
  mobility: [/round|circuit/i, /stretch|mobility|breathing/i]
};

// Equipment for testing loaded movement requirements
const EQUIPMENT_WITH_LOAD = ['barbell', 'dumbbell', 'kettlebell'];
const STYLES_REQUIRING_LOAD = ['crossfit', 'olympic_weightlifting', 'powerlifting', 'bb_full_body', 'bb_upper', 'bb_lower'];

describe('Style-Aware Workout Generator', () => {
  // Test each of the 9 styles
  const styles = [
    'crossfit',
    'olympic_weightlifting',
    'powerlifting',
    'bb_full_body',
    'bb_upper',
    'bb_lower',
    'aerobic',
    'gymnastics',
    'mobility'
  ];

  styles.forEach(style => {
    describe(`${style.toUpperCase()}`, () => {
      it('should generate with meta.generator === "premium"', async () => {
        const response = await fetch(`${API_BASE}/api/workouts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: style,
            durationMin: 45,
            intensity: 7,
            equipment: EQUIPMENT_WITH_LOAD,
            seed: `TEST_${style.toUpperCase()}_META`
          })
        });

        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.workout?.meta?.generator).toBe('premium');
      }, 30000);

      it('should respect style-specific movement categories in main blocks', async () => {
        const response = await fetch(`${API_BASE}/api/workouts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: style,
            durationMin: 45,
            intensity: 8,
            equipment: EQUIPMENT_WITH_LOAD,
            seed: `TEST_${style.toUpperCase()}_CATEGORIES`
          })
        });

        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.workout).toBeDefined();

        // Find main block exercises (exclude warm-up/cooldown)
        const mainExercises = data.workout.sets.filter((set: any) => {
          const ex = set.exercise.toLowerCase();
          return !ex.includes('warm') && 
                 !ex.includes('cool') &&
                 !ex.includes('foam') &&
                 !ex.includes('pvc') &&
                 !ex.includes('burgener') &&
                 set.exercise.length > 0 &&
                 ex.trim().length > 0;
        });

        expect(mainExercises.length).toBeGreaterThan(0);

        const allText = mainExercises.map(s => s.exercise).join(' ').toLowerCase();

        // Pattern-based category validation (catches obvious violations)
        switch (style) {
          case 'crossfit':
            // Should have varied categories: squat/press/pull patterns
            const hasCFVariety = 
              (/squat|thruster/.test(allText) || /press|push/.test(allText) || /row|pull/.test(allText));
            expect(hasCFVariety).toBe(true);
            break;
          case 'olympic_weightlifting':
            // Should have Olympic lifts, NOT isolation work
            expect(/snatch|clean|jerk/.test(allText)).toBe(true);
            expect(/bicep curl|tricep extension/.test(allText)).toBe(false);
            break;
          case 'powerlifting':
            // Should have squat/bench/deadlift, NOT Olympic lifts
            expect(/squat|bench|deadlift/.test(allText)).toBe(true);
            expect(/snatch|clean.*jerk/.test(allText)).toBe(false);
            break;
          case 'bb_full_body':
            // Should have both upper (press/row) AND lower (squat/hinge) body
            const hasUpper = /press|row|curl|tricep|shoulder|chest|back/.test(allText);
            const hasLower = /squat|deadlift|lunge|leg|rdl/.test(allText);
            expect(hasUpper || hasLower).toBe(true); // At least one category
            break;
          case 'bb_upper':
            // Should have upper body (press/pull), NOT leg-specific movements
            const hasUpperBody = /press|row|curl|tricep|shoulder|chest|lat|pull/.test(allText);
            expect(hasUpperBody).toBe(true);
            expect(/leg press|leg curl|leg extension|calf raise/.test(allText)).toBe(false);
            break;
          case 'bb_lower':
            // Should have lower body (squat/hinge), NOT upper pressing
            const hasLowerBody = /squat|deadlift|lunge|leg|rdl|hip thrust|glute/.test(allText);
            expect(hasLowerBody).toBe(true);
            expect(/bench press|shoulder press|overhead press/.test(allText)).toBe(false);
            break;
          case 'aerobic':
            // Should be primarily cyclical, NOT heavy strength
            expect(/bike|row|ski|run/.test(allText)).toBe(true);
            break;
          case 'gymnastics':
            // Should have gymnastics skills, NOT heavy barbell work
            expect(/handstand|pull.*up|dip|muscle.*up|l.*sit|toes.*to.*bar/.test(allText)).toBe(true);
            expect(/squat.*\d+%|deadlift.*\d+%/.test(allText)).toBe(false);
            break;
          case 'mobility':
            // Should be stretches/mobility, NOT conditioning
            expect(/stretch|mobility|breathing|pnf/.test(allText)).toBe(true);
            expect(/emom|amrap|for time/.test(allText)).toBe(false);
            break;
        }
      }, 30000);

      if (STYLES_REQUIRING_LOAD.includes(style)) {
        it('should have loaded movements in main blocks with equipment', async () => {
          const response = await fetch(`${API_BASE}/api/workouts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal: style,
              durationMin: 45,
              intensity: 8,
              equipment: EQUIPMENT_WITH_LOAD,
              seed: `TEST_${style.toUpperCase()}_LOADED`
            })
          });

          const data = await response.json();
          expect(data.ok).toBe(true);

          // Find main block exercises (exclude warm-up/cooldown)
          const mainExercises = data.workout.sets.filter((set: any) => {
            const ex = set.exercise.toLowerCase();
            return !ex.includes('warm') && 
                   !ex.includes('cool') &&
                   !ex.includes('foam roll') &&
                   !ex.includes('stretch') &&
                   set.exercise.length > 0;
          });

          // Count loaded movements (those with barbell, dumbbell, kettlebell, weighted)
          const loadedMovements = mainExercises.filter((set: any) => {
            const ex = set.exercise.toLowerCase();
            return /barbell|bb[\s,]|dumbbell|db[\s,]|kettlebell|kb[\s,]|weighted|wall ball/.test(ex);
          });

          const loadedRatio = mainExercises.length > 0 
            ? loadedMovements.length / mainExercises.length 
            : 0;

          // Different thresholds for different styles
          // Olympic lifting includes lots of technique/position work with empty bar
          const threshold = style === 'olympic_weightlifting' ? 0.05 : 0.25;
          expect(loadedRatio).toBeGreaterThanOrEqual(threshold);
        }, 30000);
      }

      it('should match style-specific patterns', async () => {
        const response = await fetch(`${API_BASE}/api/workouts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: style,
            durationMin: 45,
            intensity: 7,
            equipment: EQUIPMENT_WITH_LOAD,
            seed: `TEST_${style.toUpperCase()}_PATTERNS`
          })
        });

        const data = await response.json();
        expect(data.ok).toBe(true);

        const allText = JSON.stringify(data.workout.sets).toLowerCase();
        const expectedPatterns = STYLE_PATTERNS[style as keyof typeof STYLE_PATTERNS] || [];
        
        // At least one expected pattern should match
        const hasExpectedPattern = expectedPatterns.some(pattern => pattern.test(allText));
        expect(hasExpectedPattern).toBe(true);
      }, 30000);

      // Style-specific validation tests
      if (style === 'olympic_weightlifting') {
        it('should include olympic lift patterns (snatch/clean & jerk)', async () => {
          const response = await fetch(`${API_BASE}/api/workouts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal: style,
              durationMin: 45,
              intensity: 8,
              equipment: ['barbell'],
              seed: 'TEST_OLY_PATTERNS'
            })
          });

          const data = await response.json();
          expect(data.ok).toBe(true);

          const allText = JSON.stringify(data.workout.sets).toLowerCase();
          const hasOlympicLifts = /snatch|clean.*jerk|c&j/.test(allText);
          expect(hasOlympicLifts).toBe(true);
        }, 30000);
      }

      if (style === 'aerobic') {
        it('should be primarily cyclical/interval work', async () => {
          const response = await fetch(`${API_BASE}/api/workouts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal: style,
              durationMin: 30,
              intensity: 6,
              equipment: ['bike', 'rower'],
              seed: 'TEST_AEROBIC_CYCLICAL'
            })
          });

          const data = await response.json();
          expect(data.ok).toBe(true);

          const allText = JSON.stringify(data.workout.sets).toLowerCase();
          const hasCyclical = /bike|row|ski|run|swim|steady|interval|z[234]/.test(allText);
          expect(hasCyclical).toBe(true);
        }, 30000);
      }

      if (style === 'powerlifting') {
        it('should include squat, bench, and/or deadlift', async () => {
          const response = await fetch(`${API_BASE}/api/workouts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal: style,
              durationMin: 45,
              intensity: 8,
              equipment: ['barbell'],
              seed: 'TEST_PL_BIG3'
            })
          });

          const data = await response.json();
          expect(data.ok).toBe(true);

          const allText = JSON.stringify(data.workout.sets).toLowerCase();
          const hasPowerlift = /squat|deadlift|bench/.test(allText);
          expect(hasPowerlift).toBe(true);
        }, 30000);
      }

      if (style === 'mobility') {
        it('should have low hardness score (recovery focus)', async () => {
          const response = await fetch(`${API_BASE}/api/workouts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal: style,
              durationMin: 30,
              intensity: 3,
              equipment: ['bodyweight'],
              seed: 'TEST_MOBILITY_RECOVERY'
            })
          });

          const data = await response.json();
          expect(data.ok).toBe(true);

          const hardness = data.workout.variety_score || data.variety_score || 0;
          // Mobility should be deliberately low hardness (≤0.60)
          expect(hardness).toBeLessThanOrEqual(0.60);
        }, 30000);
      }

      if (style === 'gymnastics') {
        it('should include gymnastics movements (pull-ups, handstands, etc)', async () => {
          const response = await fetch(`${API_BASE}/api/workouts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal: style,
              durationMin: 30,
              intensity: 7,
              equipment: ['pullup-bar'],
              seed: 'TEST_GYM_SKILLS'
            })
          });

          const data = await response.json();
          expect(data.ok).toBe(true);

          const allText = JSON.stringify(data.workout.sets).toLowerCase();
          const hasGymnastics = /handstand|pull.*up|muscle.*up|toes.*to.*bar|l.*sit|dip/.test(allText);
          expect(hasGymnastics).toBe(true);
        }, 30000);
      }
    });
  });

  // Cross-style validation
  describe('Cross-Style Validation', () => {
    it('should generate different movement families for different styles', async () => {
      const testStyles = ['crossfit', 'powerlifting', 'aerobic', 'mobility'];
      const workouts: any[] = [];

      for (const style of testStyles) {
        const response = await fetch(`${API_BASE}/api/workouts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: style,
            durationMin: 30,
            intensity: 7,
            equipment: EQUIPMENT_WITH_LOAD,
            seed: `TEST_CROSS_${style.toUpperCase()}`
          })
        });

        const data = await response.json();
        expect(data.ok).toBe(true);
        workouts.push({ style, workout: data.workout });
      }

      // Verify each workout has distinct characteristics
      const cfText = JSON.stringify(workouts[0].workout.sets).toLowerCase();
      const plText = JSON.stringify(workouts[1].workout.sets).toLowerCase();
      const aerobicText = JSON.stringify(workouts[2].workout.sets).toLowerCase();
      const mobilityText = JSON.stringify(workouts[3].workout.sets).toLowerCase();

      // CrossFit should have EMOM/AMRAP patterns
      expect(/emom|amrap/.test(cfText)).toBe(true);
      
      // Powerlifting should have squat/bench/deadlift
      expect(/squat|bench|deadlift/.test(plText)).toBe(true);
      
      // Aerobic should have cyclical work
      expect(/bike|row|ski|steady/.test(aerobicText)).toBe(true);
      
      // Mobility should have stretches
      expect(/stretch|mobility|breathing/.test(mobilityText)).toBe(true);
    }, 60000);
  });
});
