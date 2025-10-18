# Mains Detection Fix - Style Validator

## Problem
The style validator was incorrectly computing cyclical/loaded ratios by including warm-up and cooldown blocks in the "mains" calculation. This caused false negatives where valid endurance workouts (with 100% cyclical main work) were flagged as `style_ok: false` because warm-up KB swings or other loaded movements polluted the ratio.

### Example Issue
```json
{
  "blocks": [
    { "title": "Warm-Up", "kind": "warmup", "items": [{"exercise": "KB Swings"}] },
    { "title": "Main Work", "kind": "main", "items": [{"exercise": "Run"}, {"exercise": "Row"}] },
    { "title": "Cool-Down", "kind": "cooldown", "items": [{"exercise": "Walk"}] }
  ]
}
```

**Before Fix**: KB Swings counted as "main" → loaded ratio > 0% → style_ok: false ❌  
**After Fix**: Only Run/Row counted as "main" → cyclical ratio = 100% → style_ok: true ✅

## Solution
Implemented `extractMains()` helper function that correctly isolates main work blocks:

1. **First tries explicit source flags** (`_source: 'main'` or `source: 'main'`) - most reliable
2. **Falls back to positional scan** - identifies blocks between:
   - First non-warmup header (e.g., "Main Work", "Workout", "AMRAP")
   - Next cooldown header (e.g., "Cool-Down", "Stretch")

### Helper Functions Added
```typescript
function isWarmupHeader(x: any)    // Detects "Warm-Up" headers
function isCooldownHeader(x: any)  // Detects "Cool-Down" headers  
function isHeader(x: any)          // Detects any header block
function extractMains(sets: any[]) // Extracts only main work blocks
```

### Updated Logic
```typescript
// OLD (incorrect):
const mains = sets.filter((b: any) => b.is_header !== true);

// NEW (correct):
const mains = extractMains(sets);
```

## Impact

### ✅ Accurate Ratio Calculations
- **Cyclical Ratio**: Now computed only on main work (excludes warm-up/cooldown)
- **Loaded Ratio**: Now computed only on main work (excludes warm-up/cooldown)

### ✅ Endurance Style Validation
- Endurance workouts with cyclical-only mains now correctly pass validation
- Warm-up movements (KB swings, light squats) don't pollute cyclical ratio
- `style_ok: true` for valid endurance workouts

### ✅ All Styles Benefit
- CrossFit: Loaded ratio calculated on main work only
- Olympic: Required patterns checked in main work only
- Powerlifting: Banned patterns checked in main work only

## Testing

### Smoke Tests
All 13 styles passing with correct mains detection:
```bash
✅ STYLE=endurance        ok=true gen=premium time_fit=true
✅ STYLE=crossfit         ok=true gen=premium time_fit=true
✅ STYLE=olympic          ok=true gen=premium time_fit=true
... (all 13 passing)
```

### Unit Test
```bash
🔍 Mains Extraction Test:
  Total blocks: 8
  Extracted mains: 2
  Main exercises: Run, Row
  
✅ Verification:
  KB Swings excluded from mains: true
  Run included in mains: true
  Row included in mains: true
  Walk excluded from mains: true
```

## Files Modified
- `server/ai/generators/premium.ts`:
  - Added `isWarmupHeader()` helper
  - Added `isCooldownHeader()` helper
  - Added `isHeader()` helper
  - Added `extractMains()` helper
  - Updated `validateStyleAgainstSpec()` to use `extractMains()`

## Related Documentation
- `.env.strict-test` - Strict testing environment toggles
- `BUDGET_FITTING_INTEGRATION.md` - Budget fitting guarantees
- `DURATION_AWARE_INTEGRATION.md` - Duration-aware pack builders
- `replit.md` - Updated with mains detection note
