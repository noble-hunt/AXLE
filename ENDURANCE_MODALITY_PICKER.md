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
```

### After (with rower available)
```
Block Title: "Cruise Intervals Row Z3–Z4"
Exercise: "Row" (specific)
Patterns: ['row', 'erg', 'cyclical']
```

### After (with treadmill available)
```
Block Title: "Steady Run Z2–Z3"
Exercise: "Run" (specific)
Patterns: ['run', 'cyclical']
```

## Intensity-Based Structures

The modality picker integrates with existing intensity mapping:

| Intensity | Structure | Block Title Example |
|-----------|-----------|---------------------|
| 1-5 | Steady State (Z2-Z3) | "Steady Row Z2–Z3" |
| 6-7 | Cruise/Tempo (Z3-Z4) | "Cruise Intervals Bike Z3–Z4" |
| 8-10 | VO2 Max (Z4-Z5) | "VO2 Repeats Run Z4–Z5" |

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
