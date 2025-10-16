# Development Scripts

## Developer Environment Setup

### 1. Configure Environment Variables

Create a `.env` file in the root of your repository:

```bash
# Required: OpenAI API key for premium workout generation
OPENAI_API_KEY=sk-********************************

# Development environment (enables dev defaults)
NODE_ENV=development

# Optional: Force local coaching notes (no OpenAI calls)
# HOBH_PREMIUM_NOTES_MODE=local

# Optional: Enable strict policy enforcement (throw on violations instead of auto-repair)
# HOBH_PREMIUM_STRICT=1
```

**Important Notes:**
- In `NODE_ENV=development`, premium-only mode is **automatically enabled** (no fallbacks)
- Kill switches default to `true` in development: `AXLE_DISABLE_SIMPLE=1`, `HOBH_FORCE_PREMIUM=true`, `AXLE_DISABLE_MOCK=1`
- Setting `HOBH_PREMIUM_NOTES_MODE=local` skips OpenAI for coaching notes (uses deterministic fallback)
- **Policy enforcement modes:**
  - **Repair mode (default)**: Policy violations trigger auto-fix attempts and log to `workout.meta.policy_repairs[]`
  - **Strict mode**: Set `HOBH_PREMIUM_STRICT=1` to throw errors on policy violations (original behavior)

### 2. Verify Configuration

Check effective environment flags:

```bash
curl http://localhost:5000/api/_debug/ai | jq .
```

Expected output in development:

```json
{
  "ok": true,
  "NODE_ENV": "development",
  "DEV": true,
  "HAS_OPENAI_KEY": true,
  "OPENAI_KEY_SAMPLE": "sk-pro…HkwA",
  "AXLE_DISABLE_SIMPLE": true,
  "AXLE_DISABLE_MOCK": true,
  "HOBH_FORCE_PREMIUM": true,
  "HOBH_PREMIUM_NOTES_MODE": null,
  "HOBH_PREMIUM_STRICT": false
}
```

---

## Clean Restart Helper

Use these scripts when you need to kill stale processes and start fresh (Replit sometimes keeps detached PIDs).

### Option 1: Quick Restart (Recommended)

```bash
pkill -f node || true
npm run dev
```

This approach:
- Kills all node processes
- Starts a fresh dev server
- Inherits all environment variables from `.env`

### Option 2: Node.js Script

```bash
node scripts/dev-start.mjs
```

This script:
- Spawns a clean `tsx server/index.ts` process
- Inherits all environment variables
- Shows clean exit codes

### Option 3: Bash Script (Force Kill)

```bash
./scripts/clean-start.sh
```

This script:
- Kills any stale `dev-server.pid` or `tsx server/index.ts` processes
- Waits 1 second
- Runs `npm run dev`

---

## Expected Logs

### Successful Generation

When the orchestrator runs successfully, look for:

```
[WG] start { stamp: 'WG-ORCH@1.0.1', style: 'olympic_weightlifting', minutes: 30 }
[WG] premium ok { stamp: 'WG-ORCH@1.0.1', style: 'olympic_weightlifting' }
```

### Policy Violations (Strict Mode)

In strict mode (`HOBH_PREMIUM_STRICT=1`), if premium generation fails due to policy violations:

```
[WG] premium_failed { stamp: 'WG-ORCH@1.0.1', style: 'olympic_weightlifting', err: 'policy:barbell_only:DB Snatch' }
[WG] premium_failed { stamp: 'WG-ORCH@1.0.1', style: 'crossfit', err: 'policy:loaded_ratio:0.45' }
[WG] premium_failed { stamp: 'WG-ORCH@1.0.1', style: 'olympic_weightlifting', err: 'policy:oly_required_patterns:snatch|clean_and_jerk' }
[WG] premium_failed { stamp: 'WG-ORCH@1.0.1', style: 'crossfit', err: 'policy:banned_exercise:Star Jump' }
```

### Policy Repairs (Default Mode)

In repair mode (default, `HOBH_PREMIUM_STRICT=false`), policy violations are auto-fixed and logged:

```
[WG] premium ok { stamp: 'WG-ORCH@1.0.1', style: 'olympic_weightlifting', repairs: 1 }
```

Repairs are logged in the workout response under `meta.policy_repairs`:

```json
{
  "ok": true,
  "workout": { ... },
  "meta": {
    "policy_repairs": [
      {
        "code": "barbell_only",
        "details": "Swapped 'DB Snatch' for barbell movement"
      }
    ]
  }
}
```

### Environment Configuration

On server start, you should see:

```
[dotenv@17.2.3] injecting env (0) from .env
[PID] Using PID file: /home/runner/workspace/.dev-server.pid
Loaded 49 blocks validated (0 errors)
⏰ [CRON] Daily suggestions job scheduled for 05:00 UTC
[PORT] Using env PORT=5000 → listening on 5000
```

---

## Response Headers

All workout generation responses include debug headers (visible in browser DevTools):

- `X-AXLE-Generator`: `premium` | `simple` | `mock`
- `X-AXLE-Style`: `crossfit` | `olympic_weightlifting` | `powerlifting` | etc.
- `X-AXLE-Orchestrator`: `WG-ORCH@1.0.1`

**Example in DevTools:**

```
X-AXLE-Generator: premium
X-AXLE-Style: olympic_weightlifting
X-AXLE-Orchestrator: WG-ORCH@1.0.1
```

---

## Error Response Format

All API errors return structured JSON (never `null`) with consistent format:

```json
{
  "ok": false,
  "error": "policy:barbell_only:DB Snatch",
  "code": "premium_failed",
  "style": "olympic_weightlifting",
  "stamp": "WG-ORCH@1.0.1",
  "meta": {
    "hint": "Try removing non-barbell movements",
    "policy": "barbell_only",
    "details": "Olympic weightlifting requires barbell-only movements"
  }
}
```

**Error Middleware:** `server/middleware/error.ts` ensures all uncaught errors are caught and returned as structured JSON with the orchestrator stamp, making CLI inspection easy and UI error handling consistent.

---

## Kill Switches (Advanced)

Override development defaults by explicitly setting environment variables:

```bash
# Force premium-only path (default: true in dev)
HOBH_FORCE_PREMIUM=true

# Disable simple generator fallback (default: true in dev)
AXLE_DISABLE_SIMPLE=1

# Disable mock generator fallback (default: true in dev)
AXLE_DISABLE_MOCK=1

# Enable strict policy enforcement - throw on violations instead of auto-repair (default: false)
HOBH_PREMIUM_STRICT=1

# Add debug stamp to workout titles (optional)
DEBUG_PREMIUM_STAMP=1
```

When kill switches are enabled and premium fails, routes return HTTP 502:

```json
{
  "ok": false,
  "error": "premium_failed",
  "detail": "policy:barbell_only:DB Snatch"
}
```

---

## Policy Error Codes

Premium generator enforces style-specific policies. Common error codes:

| Error Code | Meaning | Example |
|------------|---------|---------|
| `policy:category_mismatch` | Movement from wrong category | `policy:category_mismatch:gymnastics` |
| `policy:oly_required_patterns` | Missing required Olympic patterns | `policy:oly_required_patterns:snatch\|clean_and_jerk` |
| `policy:banned_exercise` | Exercise banned for this style | `policy:banned_exercise:DB Snatch` |
| `policy:barbell_only` | Non-barbell movement in barbell-only style | `policy:barbell_only:Dumbbell Snatch` |
| `policy:loaded_ratio` | Loaded movement ratio too low | `policy:loaded_ratio:0.45` |

---

## Troubleshooting

### Port Already in Use

If you see `Error: listen EADDRINUSE: address already in use :::5000`:

```bash
pkill -f node
npm run dev
```

### Stale PID File

If the server won't start and you see PID errors:

```bash
rm -f .dev-server.pid
npm run dev
```

### OpenAI Errors

If you see `OPENAI_API_KEY not set` errors:

1. Verify `.env` file exists in project root
2. Check the API key starts with `sk-`
3. Restart the server to reload environment variables

### Premium Generation Always Fails

Check the debug endpoint to verify configuration:

```bash
curl http://localhost:5000/api/_debug/ai | jq .
```

Verify:
- `HAS_OPENAI_KEY: true`
- `HOBH_FORCE_PREMIUM: true` (should be true in dev)
- `AXLE_DISABLE_SIMPLE: true` (should be true in dev)
