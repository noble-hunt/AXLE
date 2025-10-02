# Workout Generator Tests

## Running Tests

### Unit Tests
```bash
npx vitest run __tests__/workouts.premium.spec.ts
```

Or add to package.json scripts:
```json
"test:workouts": "vitest run __tests__/workouts.premium.spec.ts"
```

### Smoke Tests
```bash
node scripts/smokeWorkouts.js
```

Or add to package.json scripts:
```json
"smoke:workouts": "node scripts/smokeWorkouts.js"
```

## What's Tested

### Unit Tests (`workouts.premium.spec.ts`)
1. ✅ Forces premium generator for CrossFit
2. ✅ Validates pattern lock (E3:00, EMOM, AMRAP, For-Time, Chipper)
3. ✅ Ensures no banned BW movements in main blocks with equipment
4. ✅ Verifies acceptance flags (time_fit, mixed_rule_ok, patterns_locked)
5. ✅ Confirms conversion preserves pattern titles and item reps (no invented data)

### Smoke Tests (`smokeWorkouts.js`)
Hits three workout payloads and validates:
- Meta generator is "premium"
- Acceptance flags are correct
- No invented data like "Bird Dog x 270s"
- Clean UI sets structure
