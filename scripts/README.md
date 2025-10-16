# Development Scripts

## Clean Restart Helper

Use these scripts when you need to kill stale processes and start fresh (Replit sometimes keeps detached PIDs).

### Option 1: Node.js Script (Recommended)

```bash
node scripts/dev-start.mjs
```

This script:
- Spawns a clean `tsx server/index.ts` process
- Inherits all environment variables
- Shows clean exit codes

### Option 2: Bash Script (Force Kill)

```bash
./scripts/clean-start.sh
```

This script:
- Kills any stale `dev-server.pid` or `tsx server/index.ts` processes
- Waits 1 second
- Runs `npm run dev`

### Expected Logs

When the orchestrator runs, you should see logs like:

```
[WG] start { stamp: 'WG-ORCH@1.0.0', style: 'olympic_weightlifting', minutes: 30 }
[WG] premium ok { stamp: 'WG-ORCH@1.0.0' }
```

If premium generation fails, you'll see:

```
[WG] premium_failed { stamp: 'WG-ORCH@1.0.0', err: 'policy:barbell_only:DB Snatch' }
[WG] premium_failed { stamp: 'WG-ORCH@1.0.0', err: 'policy:loaded_ratio:0.45' }
[WG] premium_failed { stamp: 'WG-ORCH@1.0.0', err: 'policy:oly_required_patterns:snatch|clean_and_jerk' }
```

### Debug Endpoint

Check environment flags at any time:

```bash
curl http://localhost:5000/api/_debug/ai | jq .
```

Expected output:

```json
{
  "ok": true,
  "HAS_OPENAI_KEY": true,
  "OPENAI_KEY_SAMPLE": "sk-pro…HkwA",
  "AXLE_DISABLE_SIMPLE": false,
  "AXLE_DISABLE_MOCK": false,
  "HOBH_FORCE_PREMIUM": false,
  "HOBH_PREMIUM_NOTES_MODE": null
}
```

### Response Headers

All workout generation responses include debug headers (visible in DevTools):

- `X-AXLE-Generator`: `premium` | `simple` | `mock`
- `X-AXLE-Style`: `crossfit` | `olympic_weightlifting` | etc.
- `X-AXLE-Orchestrator`: `WG-ORCH@1.0.0`

### Kill Switches

Set these environment variables to enforce premium-only generation:

```bash
AXLE_DISABLE_SIMPLE=1      # Prevents fallback to simple generator
HOBH_FORCE_PREMIUM=true    # Forces premium path (default behavior)
DEBUG_PREMIUM_STAMP=1      # Adds debug headers for verification
```

When kill switches are enabled and premium fails, routes return:

```json
{
  "ok": false,
  "error": "premium_failed",
  "detail": "Premium generator not used (got: simple). Kill switches prevent fallback."
}
```
