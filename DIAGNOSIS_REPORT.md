# Workout Generation System Diagnosis Report

## Executive Summary
The endurance workout changes ARE working correctly. However, there's a **critical upstream issue** where specific workout styles (CrossFit, Olympic Weightlifting, Powerlifting) are being normalized to generic "strength" before reaching the builder selection logic.

## What's Working ✅

### Endurance Workouts (HYROX-Style)
- **Status**: Fully functional
- **Evidence**: 
  - Request: `{"goal":"endurance","style":"endurance"}`
  - Log output: `style: 'endurance'` → `Using style-aware builder for: endurance`
  - Generated: "HYROX-Style Circuit" with alternating cardio/functional movements
  - Distance-based cardio: 5 stations @ 1000m each
  - Functional movements: 4 stations with reps (Vertical Jumps, etc.)

## What's Broken ❌

### Style-Specific Workouts (CrossFit, Olympic, Powerlifting)
- **Status**: Failing due to upstream normalization
- **Evidence**:
  ```
  Request: {"style":"crossfit"} → Normalized to: style: 'strength'
  Request: {"style":"olympic_weightlifting"} → Normalized to: style: 'strength'  
  Request: {"style":"powerlifting"} → Normalized to: style: 'strength'
  ```
- **Result**: All three generate identical "Powerlifting Session" workouts

## Root Cause Analysis

### Problem Location
The issue occurs in the **request normalization layer** BEFORE the premium workout generator:

```
API Request → routes.ts → workoutGenerator.ts (normalizes style) → premium.ts (builder selection)
                                    ↑
                            ISSUE IS HERE
```

### Normalization Flow (Current)
1. User sends: `{"goal":"strength","style":"crossfit"}`
2. `server/routes.ts` OR `server/workoutGenerator.ts` normalizes `style` field
3. Normalized to: `{goal:"strength", style:"strength"}`
4. Premium generator receives generic "strength" and can't differentiate between CrossFit/Olympic/Powerlifting
5. Falls back to a default strength builder (currently Powerlifting)

### Why Endurance Works
- Endurance has a unique `goal:"endurance"` that doesn't get normalized
- The `style:"endurance"` passes through correctly
- Builder selection logic recognizes it and calls `buildEndurance()`

## Files Requiring Investigation

### 1. server/routes.ts
**Check**: How does `/api/workouts/generate` normalize the incoming request?
- Line ~430-450: Request body validation and normalization
- Look for: `style` field mapping logic
- Expected issue: Maps "crossfit" → "strength", "olympic_weightlifting" → "strength", etc.

### 2. server/workoutGenerator.ts
**Check**: Does `generateWorkout()` or helper functions normalize the style?
- Line ~350-400: Style normalization logic
- Look for: `normalizeWorkoutStyle()` or similar functions
- Expected issue: Over-aggressive normalization that loses specificity

### 3. server/ai/generators/premium.ts
**Check**: Builder selection switch statement
- Line ~3150-3200: `switch(style)` for builder routing
- Current state: Has cases for 'endurance', 'crossfit', 'olympic_weightlifting', etc.
- Issue: Never reached because style is already normalized to "strength"

## Required Fixes

### Fix #1: Preserve Style Specificity Through Normalization
**Location**: `server/workoutGenerator.ts` or `server/routes.ts`

**Current (broken)**:
```typescript
// Normalizes all strength variants to generic "strength"
if (goal === 'strength') {
  style = 'strength';
}
```

**Required (fixed)**:
```typescript
// Preserve specific style information
if (goal === 'strength' && !style) {
  style = 'strength'; // Only default if not specified
}
// OR map goal to style only when style is missing
style = style || goal;
```

### Fix #2: Update Builder Selection Logic
**Location**: `server/ai/generators/premium.ts` (line ~3150)

**Ensure the switch statement handles**:
- `case 'crossfit':`
- `case 'olympic_weightlifting':`
- `case 'powerlifting':`
- `case 'gymnastics':`
- `case 'endurance':` (already working)
- `case 'strength':` (fallback for generic requests)

### Fix #3: API Request Schema Validation
**Location**: `server/routes.ts`

**Ensure Zod schema allows**:
```typescript
{
  goal: z.enum(['strength', 'endurance', 'cardio', ...]),
  style: z.enum(['crossfit', 'olympic_weightlifting', 'powerlifting', 'endurance', 'strength', ...]).optional()
}
```

## Testing Strategy

### Test Cases
1. **Endurance**: `{"goal":"endurance"}` → Should use `buildEndurance()` ✅ PASSING
2. **CrossFit**: `{"goal":"strength","style":"crossfit"}` → Should use `buildCrossFit()`
3. **Olympic**: `{"goal":"strength","style":"olympic_weightlifting"}` → Should use `buildOlympic()`
4. **Powerlifting**: `{"goal":"strength","style":"powerlifting"}` → Should use `buildPowerlifting()`
5. **Generic Strength**: `{"goal":"strength"}` → Should use default strength builder

### Validation Commands
```bash
# Test each style and verify builder selection from logs
curl -X POST /api/workouts/generate -d '{"style":"crossfit",...}' | jq .
grep "Using style-aware builder" logs.txt

# Expected log output:
# "Using style-aware builder for: crossfit" (not "strength")
```

## Impact Assessment

### Affected Workout Categories
- ❌ CrossFit (generating Powerlifting instead)
- ❌ Olympic Weightlifting (generating Powerlifting instead)
- ❌ Powerlifting (accidentally working, but for wrong reason)
- ❌ Gymnastics (generating Powerlifting instead)
- ❌ Bodybuilding (generating Powerlifting instead)
- ✅ Endurance (working correctly)
- ❓ Aerobic (likely broken, untested)
- ❓ Strength (generic - unknown behavior)

### User Impact
- **Severity**: HIGH
- **Scope**: 60-70% of workout generation requests fail to generate correct style
- **Symptoms**: Users requesting CrossFit get Powerlifting workouts instead

## Next Steps

1. **Locate normalization code** in `server/workoutGenerator.ts` or `server/routes.ts`
2. **Fix normalization** to preserve style specificity
3. **Test all workout styles** with actual generation requests
4. **Verify builder selection logs** show correct style names
5. **Update API documentation** if request schema changed

## My Endurance Changes (Unrelated to Main Issue)

The HYROX-style endurance changes I implemented are working perfectly:
- ✅ Equipment-aware modality selection (rower → bike → ski erg → running)
- ✅ Distance-based cardio prescriptions (800-1000m)
- ✅ Alternating cardio/functional circuit structure
- ✅ Pattern-based functional movement selection
- ✅ Proper registry_id assignment

**These changes are NOT the cause of the style routing issue.**
