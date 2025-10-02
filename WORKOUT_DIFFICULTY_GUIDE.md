# 🔥 Workout Difficulty Control System

## 📊 Complete Generation Flow

```
API Request (/api/workouts/generate)
    ↓
[1] server/routes.ts → Validates request
    ↓
[2] server/workoutGenerator.ts → Routes to appropriate generator
    ↓
[3a] PREMIUM PATH (CrossFit/HIIT with equipment)
    ↓
    server/ai/generators/premium.ts
    ├── generatePremiumWorkout() → Calls OpenAI
    ├── sanitizeWorkout() → Enforces rules & hardness
    └── computeHardness() → Calculates difficulty score
    ↓
[3b] OR SIMPLE PATH (other categories)
    ↓
    server/ai/generators/simple.ts
    └── generateSimpleWorkout()
    ↓
[4] convertPremiumToGenerated() → Converts to UI format
    ↓
[5] Response → Returns workout to frontend
```

---

## 🎯 Difficulty Control Points

### **1. HARDNESS FLOOR** (Primary Difficulty Control)
**File:** `server/ai/generators/premium.ts`
**Function:** `sanitizeWorkout()` (lines 641-710)

```typescript
// CURRENT VALUES:
let floor = 0.65;  // Base hardness floor

if (hasLoad && !lowReadiness) {
  floor = 0.75;  // ← INCREASE THIS for harder workouts with equipment
} else if (lowReadiness) {
  floor = 0.55;  // ← Low readiness floor
}

// If workout.variety_score < floor → Adds finisher block
```

**💡 TO MAKE WORKOUTS HARDER:**
- Change `floor = 0.75` to `floor = 0.85` or `floor = 0.90`
- Change base `floor = 0.65` to `floor = 0.75`

---

### **2. HARDNESS CALCULATION** (What Makes a Workout Hard)
**File:** `server/ai/generators/premium.ts`
**Function:** `computeHardness()` (lines 402-454)

```typescript
// Pattern bonuses (how much each pattern contributes):
if (/E[34]:00/i.test(b.title)) h += 0.28;    // ← INCREASE for harder
if (/EMOM/i.test(b.title)) h += 0.22;        // ← INCREASE for harder
if (/AMRAP/i.test(b.title)) h += 0.22;       // ← INCREASE for harder
if (/21-15-9/.test(b.title)) h += 0.20;      // ← INCREASE for harder
if (/Chipper/i.test(b.title)) h += 0.24;     // ← INCREASE for harder

// Equipment bonuses:
if (hasBarbell) h += 0.05;     // ← INCREASE for harder
if (hasDbKb) h += 0.03;        // ← INCREASE for harder
if (hasCyclical) h += 0.02;    // ← INCREASE for harder

// Heavy movement bonuses:
if (text.includes("clean & jerk")) h += 0.05;  // ← INCREASE for harder
if (text.includes("thruster")) h += 0.05;
if (text.includes("deadlift")) h += 0.05;
// ... add more movements or increase bonuses
```

**💡 TO MAKE WORKOUTS HARDER:**
- Increase pattern bonuses (e.g., `h += 0.35` instead of `0.28`)
- Increase equipment bonuses (e.g., `h += 0.10` instead of `0.05`)
- Add more heavy movements with bonuses

---

### **3. OPENAI PROMPT** (What AI Generates)
**File:** `server/ai/generators/premium.ts`
**Function:** `createUserPrompt()` (lines 814-869)

```typescript
// Current prompt includes:
- Target Intensity: ${intensity}/10

// HIDDEN INSTRUCTION (line 250+):
Conditioning Strength Requirements:
- Target at least 3-4 reps for complex barbell lifts
- For EMOM: 10+ minutes, alt cardio/strength
- For AMRAP: 8-15 min with 2-3 movements
```

**💡 TO MAKE WORKOUTS HARDER:**
- Edit the prompt to increase rep minimums
- Request heavier weight prescriptions (e.g., "Use 80-85% 1RM instead of 70-75%")
- Add "MANDATORY: Include at least 2 barbell movements per main block"

---

### **4. INTENSITY UPGRADER** (Post-Generation Boost)
**File:** `server/workoutGenerator.ts`
**Function:** `upgradeIntensity()` (lines 19-48)

```typescript
// Timing upgrades:
if (/Every\s*3:00/i.test(b.title)) 
  b.title = b.title.replace(/Every\s*3:00/i, 'Every 2:30');  // ← Make tighter
if (/EMOM\s*10\b/i.test(b.title)) 
  b.title = b.title.replace(/EMOM\s*10\b/i, 'EMOM 12');      // ← Make longer

// Rep upgrades:
if (typeof it.scheme?.reps === 'number') 
  it.scheme.reps = Math.round(it.scheme.reps * 1.15);        // ← 15% more reps
```

**💡 TO MAKE WORKOUTS HARDER:**
- Change `Every 3:00` → `Every 2:00` (instead of 2:30)
- Change `EMOM 10` → `EMOM 14` (instead of 12)
- Change `* 1.15` → `* 1.25` (25% more reps instead of 15%)

---

### **5. FINISHER INJECTION** (Emergency Difficulty Boost)
**File:** `server/ai/generators/premium.ts`
**Lines:** 662-696

```typescript
// Automatically adds if hardness < floor:
const finisher = {
  kind: "conditioning",
  title: "For Time 21-15-9",
  time_min: 8,
  items: [
    { exercise: finisherMovement, target: "21-15-9" },
    { exercise: finisherSecondMovement, target: "21-15-9" }
  ]
};
```

**💡 TO MAKE WORKOUTS HARDER:**
- Change `time_min: 8` → `time_min: 12`
- Change `"21-15-9"` → `"30-20-10"` (more total reps)
- Add a third movement to finisher

---

## 🔧 RECOMMENDED CHANGES FOR HARDER WORKOUTS

### **Quick Fix (Easy - 5 minutes):**
Edit `server/ai/generators/premium.ts`:

```typescript
// Line 645: Change hardness floor
if (hasLoad && !lowReadiness) {
  floor = 0.85;  // ← Was 0.75, now 0.85 (MUCH harder)
}

// Line 642: Change base floor
let floor = 0.75;  // ← Was 0.65, now 0.75
```

### **Medium Fix (Moderate - 15 minutes):**
Edit `server/ai/generators/premium.ts`:

1. **Increase pattern bonuses (lines 407-411):**
```typescript
if (/E[34]:00/i.test(b.title)) h += 0.35;  // Was 0.28
if (/EMOM/i.test(b.title)) h += 0.30;      // Was 0.22
if (/AMRAP/i.test(b.title)) h += 0.30;     // Was 0.22
if (/21-15-9/.test(b.title)) h += 0.28;    // Was 0.20
if (/Chipper/i.test(b.title)) h += 0.32;   // Was 0.24
```

2. **Increase equipment bonuses (lines 419-421):**
```typescript
if (hasBarbell) h += 0.10;   // Was 0.05
if (hasDbKb) h += 0.07;      // Was 0.03
if (hasCyclical) h += 0.05;  // Was 0.02
```

### **Advanced Fix (Full Control - 30 minutes):**
Edit the OpenAI prompt in `server/ai/generators/premium.ts`:

```typescript
// Around line 250, add to CONDITIONING STRENGTH REQUIREMENTS:
INTENSITY REQUIREMENTS:
- Intensity 6-7: Use 70-75% working weights, moderate pace
- Intensity 8: Use 80-85% working weights, challenging pace
- Intensity 9-10: Use 85-95% working weights, maximum effort

REP MINIMUMS (enforce strictly):
- Barbell complexes: minimum 5 reps per movement
- EMOM blocks: minimum 12 minutes
- AMRAP blocks: minimum 12 minutes
- For Time: minimum 21-15-9 reps (never lower)
```

---

## 📝 FILES TO EDIT (Summary)

| File | Function | What It Controls | Difficulty Impact |
|------|----------|-----------------|-------------------|
| `server/ai/generators/premium.ts` | `sanitizeWorkout()` | Hardness floor enforcement | ⭐⭐⭐⭐⭐ (Highest) |
| `server/ai/generators/premium.ts` | `computeHardness()` | How difficulty is scored | ⭐⭐⭐⭐ |
| `server/ai/generators/premium.ts` | `createUserPrompt()` | What AI generates | ⭐⭐⭐⭐ |
| `server/workoutGenerator.ts` | `upgradeIntensity()` | Post-generation boost | ⭐⭐⭐ |

---

## 🧪 TESTING YOUR CHANGES

After making changes, test with:

```bash
# 1. Restart the server
npm run dev

# 2. Test with curl (check hardness score in logs)
curl -X POST http://localhost:5000/api/workouts/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "goal": "CrossFit",
    "durationMin": 30,
    "intensity": 8,
    "equipment": ["barbell", "dumbbell"],
    "seed": "DIFFICULTY_TEST"
  }' | jq '.workout.variety_score'

# 3. Check logs for hardness calculation
# Look for: "✅ Premium workout generated: ... hardness: 0.XX"
```

**Target hardness scores:**
- Easy: 0.50-0.65
- Moderate: 0.65-0.75
- Hard: 0.75-0.85
- Very Hard: 0.85-1.00

---

## 🚨 COMMON ISSUES

### Issue: "Workouts still too easy"
**Solution:** Increase the hardness floor to 0.85-0.90

### Issue: "Finisher always gets added"
**Solution:** That's because hardness < floor. Either:
- Lower the floor (makes workouts easier)
- OR increase pattern/equipment bonuses (makes base workouts harder)

### Issue: "AI ignores intensity"
**Solution:** Edit the OpenAI prompt to be more explicit about weight percentages and rep minimums

---

## 🎯 QUICK START

**To make ALL workouts significantly harder RIGHT NOW:**

1. Open `server/ai/generators/premium.ts`
2. Find line ~645: `floor = 0.75;`
3. Change to: `floor = 0.90;`
4. Find line ~642: `let floor = 0.65;`
5. Change to: `let floor = 0.80;`
6. Restart server: `npm run dev`

**Result:** Workouts will be 15-20% harder immediately.
