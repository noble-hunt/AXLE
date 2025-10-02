# AXLE - Fitness Tracking Application

_Last updated: October 2, 2025_

## Overview

AXLE is a modern, mobile-first Progressive Web App (PWA) designed for comprehensive fitness tracking. Its core purpose is to enable users to log workouts, track personal records, visualize achievements, and analyze their fitness progress through detailed reports. The application offers a clean, intuitive interface with a comprehensive dashboard, optimized for mobile devices, supporting a holistic approach to fitness management.

Near-term generator is **rule-based** (deterministic by seed); long-term we'll swap in a **fine-tuned model** that emits the **same schema** so the UI/API remain unchanged.

## User Preferences

Preferred communication style: Simple, everyday language.

## Current Status

### ✅ Completed Features
- **App runs cleanly** in dev (Replit) with Vite + Express
- **Error visibility**: unified `httpJSON` fetch wrapper + toast errors; no more silent failures
- **Sentry** wired for client (React) and server (Express) with DSNs via env
- **Health checks**: `/api/healthz` returns JSON and is used by CI
- **CI (GitHub Actions)**: install → build/typecheck/lint → ping health endpoint
- **Cron** (server): "daily suggestions" job scheduled (05:00 UTC)
- **Workout generator flow** with 5-step wizard (Focus → Duration → Equipment → Intensity → Preview)
- **Premium AI generator** with OpenAI integration:
  - CrossFit/HIIT format with strict time-boxed patterns (E3:00/E4:00, EMOM, AMRAP, For-Time, Chipper)
  - Pattern lock validation with automatic regeneration on failure
  - Banned bodyweight movements in main blocks when equipment available
  - Hardness floor enforcement (0.75 for equipped + good readiness, 0.55 for low readiness)
  - Deterministic seeding with weighted movement selection
  - Meta tracing (generator, acceptance flags, seed) for reproducibility
- **Backend preview endpoint**: `POST /api/workouts/preview` (returns validated plan)
- **Schema guard**: runtime validation prevents "empty plan" responses
- **Routing/UI**: "Start Now" (daily suggestion) and "Create New Workflow" work correctly

### 🟨 In Progress / Planned
- **Mobile UI polish**: some cards still need responsive tweaks
- **Auth 401s**: some suggestion endpoints can return 401 without token—non-blocking but should be tightened
- **Push notifications**: VAPID planned; keys required; not yet user-visible
- **Capacitor/iOS wrapper**: approved plan; waiting on machine/Xcode

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite for fast development and optimized builds
- **Design**: Mobile-first, responsive design using Tailwind CSS
- **UI Components**: shadcn/ui built on Radix UI primitives for accessibility and consistency
- **State Management**:
    - Client-side: Zustand for app settings and active workouts, with local persistence for offline capabilities
    - Server-side: TanStack Query for data fetching, caching, and synchronization
- **Error Handling**: `client/src/lib/http.ts (httpJSON)` checks content-type, parses JSON/text, throws structured `HttpError`

### Backend Architecture
- **Server**: Express.js with a RESTful API, implemented in TypeScript for type safety
- **Modularity**: Abstracted storage interface (`IStorage`) with an in-memory option for development
- **API Validation**: Zod schemas for request validation
- **Workout Generation**: Three-tier fallback chain (premium → simple → mock) with routing orchestrator
  - Premium generator uses OpenAI for CrossFit/HIIT workouts with equipment
  - Pattern lock validation enforces allowed patterns only
  - Hardness calculation with floor enforcement and automatic finisher injection
  - Banned BW movements: Wall Sit, Mountain Climber, Star Jump, High Knees, Jumping Jacks, Bicycle Crunch

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries and schema management
- **Schema**: Includes tables for users (authentication), workouts (with JSON exercise data), personal records, and achievements
- **Single source of truth**: `WorkoutPlan` schema at `shared/workoutSchema.ts` (shared by server & client)
  - Movements, prescriptions, blocks, total time, etc.
  - Every plan must validate: no empty blocks, consistent dosing, equipment awareness
  - Lets us swap the rule engine for an ML model later with zero UI changes

### Deterministic Generation
- `mulberry32` RNG + `strSeed(seed)` produce the same plan for the same inputs
- Used for QA repro ("Seed: A1DB6660" badge shown on preview)
- All workouts include meta.generator, meta.acceptance, and meta.seed for tracing

### Styling and Theming
- **Framework**: Tailwind CSS for utility-first styling and a custom design system
- **Theming**: CSS variables for dynamic light/dark mode support
- **Design System**: Card-based UI with consistent spacing, typography, and a brand-optimized color palette

### Development and Build Process
- **Structure**: Monorepo with shared types and schemas (`/shared`)
- **Build Tools**: Vite for client, esbuild for server
- **Development Environment**: Integrated Vite dev server with Express

## API Surface

### Health & Status
- `GET /api/healthz` → `{ ok: true, uptime, version, env }`

### Workout Generation
- `POST /api/workouts/generate`
  ```json
  {
    "goal": "CrossFit|HIIT|strength|conditioning|mixed|endurance",
    "durationMin": 10..120,
    "intensity": 1..10,
    "equipment": ["bodyweight","dumbbell","kettlebell","barbell"],
    "seed": "optional-string"
  }
  ```
  Returns: Full workout with meta tracing

- `POST /api/workouts/preview`
  ```json
  {
    "focus": "strength|conditioning|mixed|endurance",
    "durationMin": 10..120,
    "intensity": 1..10,
    "equipment": ["bodyweight","dumbbell","kettlebell","barbell"],
    "seed": "optional-string"
  }
  ```
  Returns: `WorkoutPlan` (validated, non-empty blocks)

### Suggestions
- `/api/workouts/suggest/today` - Daily workout suggestion
- Note: may require authenticated requests; minor 401s observed

## External Dependencies

### UI and Component Libraries
- **Radix UI**: Accessible UI primitives
- **Lucide React**: Icon library
- **class-variance-authority**: Variant-based component APIs
- **cmdk**: Command palette

### State Management and Data Fetching
- **TanStack Query**: Server state management
- **Zustand**: Client-side state management

### Database and ORM
- **Drizzle ORM**: Type-safe database toolkit
- **Neon Database**: Serverless PostgreSQL
- **Drizzle Kit**: Database migration and introspection

### AI and Generation
- **OpenAI**: Premium workout generation with GPT-4
- **Seeded Random**: Deterministic workout generation for reproducibility

### Development and Build Tools
- **Vite**: Fast build tool and dev server
- **esbuild**: Fast JavaScript bundler
- **PostCSS**: CSS processing
- **TypeScript**: Static type checking

### Utility Libraries
- **date-fns**: Date manipulation
- **clsx/tailwind-merge**: Conditional CSS classes
- **nanoid**: Unique ID generation
- **react-hook-form**: Form state management
- **zod**: Schema validation

### Monitoring and Observability
- **Sentry**: Error tracking for client and server
- **Pino-http**: HTTP request logging

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store
- **express-session**: Session middleware

## Premium Workout Generator

### Pattern Lock System
- **Allowed Patterns**: E3:00/E4:00 x N, EMOM 10-16, AMRAP 8-15, For Time 21-15-9, Chipper 40-30-20-10
- **Validation**: All main blocks must match allowed patterns
- **Regeneration**: Automatic retry with strengthened instructions on validation failure

### Banned Bodyweight Movements
When equipment (barbell/dumbbell/kettlebell) is available, the following movements are banned from main blocks:
- Wall Sit, Mountain Climber, Star Jump, High Knees, Jumping Jacks, Bicycle Crunch

### Hardness Floor Enforcement
- **0.75 floor** for equipped workouts (barbell/dumbbell/kettlebell) with good readiness (sleep ≥60)
- **0.55 floor** for low readiness (sleep <60)
- **Automatic finisher injection** when below threshold to meet requirements
- **Hardness calculation**: Pattern bonuses + equipment bonuses - BW-only penalties

### Meta Tracing
All workouts include:
- `meta.generator`: "premium" | "simple" | "mock"
- `meta.acceptance`: { patterns_locked, hardness_ok, mixed_rule_ok, equipment_ok }
- `meta.seed`: Reproducibility seed

## Environment Variables

### Required
- `VITE_API_BASE_URL` (client) – dev: `http://localhost:5000`; prod: your API host
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for premium generation

### Sentry (Error Tracking)
- `SENTRY_DSN_SERVER`, `SENTRY_ENV`
- `VITE_SENTRY_DSN_CLIENT`, `VITE_SENTRY_ENV`

### Web Push (Planned)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `VITE_VAPID_PUBLIC_KEY` (client)

### CI/CD
- `PROD_SITE_URL` (used by GitHub Actions E2E ping)

## Development Runbook

### Local/Replit Dev
```bash
npm ci
npm run dev
# Runs: concurrently "NODE_ENV=development tsx server/index.ts" "vite --host 0.0.0.0 --port 5173"
```

### Database Migrations
```bash
npm run db:push        # Push schema changes
npm run db:push --force # Force push when data loss warning
```

### Testing Premium Generator
```bash
curl -X POST http://localhost:5000/api/workouts/generate \
  -H 'Content-Type: application/json' \
  -d '{"goal":"CrossFit","durationMin":45,"intensity":8,"equipment":["barbell","dumbbell"],"seed":"TEST_SEED"}'
```

## CI/CD Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`):
- Node 20, `npm ci`
- Typecheck `tsc --noEmit`
- Lint `eslint` (no warnings)
- Build client
- **E2E ping**: `curl $PROD_SITE_URL/api/healthz` (fast prod smoke)

## Troubleshooting

- **Preview fails / 404**: wrong route (ensure `POST /api/workouts/preview`), or double `/api/api/...` in client paths
- **`[object Object]` toast**: fixed by `httpJSON`; if seen again, an error is bypassing the wrapper
- **Blank page**: Vite running but API down, or `VITE_API_BASE_URL` missing
- **CORS**: server allows Vercel *.vercel.app and local dev
- **401 on suggestions**: ensure auth token is attached in `httpJSON` for protected routes

## Recent Changes

### October 2, 2025
- Implemented pattern lock validation with allowed patterns whitelist
- Added banned bodyweight movements checker for main blocks
- Raised hardness floor to 0.75 (equipped + good readiness) / 0.55 (low readiness)
- Added hardness penalties/bonuses for movement quality
- Implemented automatic regeneration on validation failures
- Added meta tracing for generator transparency and reproducibility

## Roadmap

### Near-term
1. Integrate example workouts & catalog → upgrade templates and tags
2. Add unit tests for generator presets and equipment rules
3. Ship web push MVP for daily suggestion nudges
4. Wrap with Capacitor (iOS) once on new Mac/Xcode
5. Add Sentry breadcrumbs around generator decisions for debug clarity

### Long-term
- Swap rule-based generator for fine-tuned ML model (same schema)
- Enhanced movement library with video demonstrations
- Social features expansion
- Advanced analytics and progress tracking
