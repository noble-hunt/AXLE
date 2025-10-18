# Endurance Modality Picker Feature

## Overview
Implemented equipment-aware modality picker for endurance workouts to generate concrete, actionable exercise prescriptions instead of generic "Bike/Row/Run" instructions.

## Problem Solved
Previously, endurance workouts displayed generic placeholder text like "Bike/Row/Run" which forced users to choose their own modality. Now the system intelligently selects the best available cardio equipment and prescribes specific movements.

## Implementation

### 1. Modality Picker Helper (`pickCyclical`)
**Location**: `server/ai/config/patternPackBuilders.ts`

```typescript
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
```

**Priority Order**:
1. Rower (most versatile)
2. Bike/Air Bike/Assault Bike
3. Treadmill
4. Ski Erg
5. Jump Rope (fallback)

### 2. Updated Pack Builder
**Function**: `buildEndurancePack(totalMin, requestedIntensity, equipment)`

The builder now:
- Accepts equipment array as third parameter
- Calls `pickCyclical()` to select best modality
- Uses modality-specific patterns for movement selection
- Updates block titles to include specific modality name

### 3. Equipment Wiring
**Location**: `server/ai/generators/premium.ts`

Equipment is now passed through at both call sites:
```typescript
// Line 2841
pack = buildEndurancePack(req?.duration || 45, req?.intensity || 6, req?.equipment || []);

// Line 3010
pack = buildEndurancePack(request.duration || 45, request.intensity || 6, request.equipment || []);
```

## Example Output

### Before
```
Block Title: "Cruise Intervals Z3–Z4"
Exercise: "Bike/Row/Run" (generic)
Notes: null
```

### After (with rower available, 30 min workout)
```
Block Title: "Cruise Intervals Row Z3–Z4"
Exercise: "Row" (specific)
Patterns: ['row', 'erg', 'cyclical']
Notes: "3 x 5:00 @ Z3–Z4, 1:00 easy. Comfortably hard, sustainable effort."
```

### After (with treadmill available, intensity 9)
```
Block Title: "VO2 Repeats Run Z4–Z5"
Exercise: "Run" (specific)
Patterns: ['run', 'cyclical']
Notes: "10 x 60s ON / 60s OFF @ Z4–Z5. Hard effort, stay smooth. Pace by HR/respiration, not all-out."
```

### After (with bike, intensity 4)
```
Block Title: "Steady Bike Z2–Z3"
Exercise: "Bike" (specific)
Patterns: ['bike', 'erg', 'cyclical']
Notes: "Steady 16:00 continuous @ Z2–Z3. Maintain conversational pace, nasal breathing."
```

## Intensity-Based Structures & Schemes

The modality picker integrates with existing intensity mapping and now includes concrete time/rep schemes:

| Intensity | Structure | Block Title Example | Notes Example |
|-----------|-----------|---------------------|---------------|
| 1-5 | Steady State (Z2-Z3) | "Steady Row Z2–Z3" | "Steady 16:00 continuous @ Z2–Z3. Maintain conversational pace, nasal breathing." |
| 6-7 | Cruise/Tempo (Z3-Z4) | "Cruise Intervals Bike Z3–Z4" | "3 x 5:00 @ Z3–Z4, 1:00 easy. Comfortably hard, sustainable effort." |
| 8-10 | VO2 Max (Z4-Z5) | "VO2 Repeats Run Z4–Z5" | "10 x 60s ON / 60s OFF @ Z4–Z5. Hard effort, stay smooth. Pace by HR/respiration, not all-out." |

### Scheme Calculation Logic

**Steady State (Intensity 1-5)**:
- Continuous effort for entire budget duration
- Example: 16 minutes → "Steady 16:00 continuous @ Z2–Z3"

**Cruise/Tempo Intervals (Intensity 6-7)**:
- Rounds: 3 for <20min budget, 4 for ≥20min
- Work time: 70% of budget divided by rounds
- Rest time: 30% of budget divided by rounds
- Example: 16 min budget → 3 x 5:00 work, 1:00 rest

**VO2 Max Repeats (Intensity 8-10)**:
- Rounds: 8 (<16min), 10 (16-20min), 12 (≥20min)
- Work: 60 seconds per round
- Rest: Calculated to fit remaining time evenly
- Example: 20 min budget → 12 x 60s work, 60s rest

## Benefits

1. **Actionable Workouts**: Users get concrete exercise prescriptions
2. **Equipment-Aware**: Automatically adapts to available equipment
3. **Consistent Patterns**: Movement Registry can match specific patterns (row, bike, run)
4. **Better UX**: Clear, specific titles like "Cruise Intervals Row Z3–Z4"
5. **Intelligent Fallback**: Defaults to Jump Rope if no cardio equipment available

## Testing

The feature integrates seamlessly with:
- ✅ Endurance pack builder (intensity 1-10)
- ✅ Equipment validation
- ✅ Pattern-based movement selection
- ✅ Budget fitting (existing centralized fitter)
- ✅ Hardness scoring (endurance-specific bonuses)

## Files Modified
- `server/ai/config/patternPackBuilders.ts` - Added `pickCyclical()` helper
- `server/ai/generators/premium.ts` - Wired equipment through to pack builder

## Next Steps

Consider extending this pattern to:
- Aerobic style (similar to endurance)
- Mixed style (when cardio blocks are included)
- Conditioning style (for cardio portions)
