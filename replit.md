# AXLE - Fitness Tracking Application

## Overview

AXLE is a mobile-first Progressive Web App (PWA) for comprehensive fitness tracking, enabling users to log workouts, track personal records, visualize achievements, and analyze fitness progress. The application offers an intuitive interface with a dashboard optimized for mobile devices, supporting holistic fitness management. The long-term vision includes integrating a fine-tuned ML model for workout generation, maintaining consistent UI/API schema.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite
- **Design**: Mobile-first, responsive using Tailwind CSS
- **UI Components**: shadcn/ui built on Radix UI
- **State Management**: Zustand for client-side, TanStack Query for server-side data fetching
- **Error Handling**: Structured `HttpError`

### Backend Architecture
- **Server**: Express.js with a RESTful API in TypeScript
- **Modularity**: Abstracted storage interface (`IStorage`)
- **API Validation**: Zod schemas
- **Workout Generation**: Three-tier fallback (premium → simple → mock) orchestrator. The premium generator uses a **registry-first architecture** where movements are selected deterministically from the movement registry, and AI is only used for generating coaching notes and pacing tips.
- **Premium-Only Enforcement**: Environment kill switches ensure exclusive use of the premium generator:
  - `AXLE_DISABLE_SIMPLE=1`: Prevents fallback to simple generator, returns 502 if premium fails
  - `HOBH_FORCE_PREMIUM=true`: Forces premium path (default behavior)
  - `DEBUG_PREMIUM_STAMP=1`: Adds debug headers (`X-AXLE-Generator`, `X-AXLE-Style`) for verification
  - Routes `/api/workouts/generate` and `/api/workouts/simulate` enforce these constraints with clear 502 error responses
- **Multi-Layer Style Normalization** (October 2025):
  - **Canonical Source**: `server/lib/style.ts` - single source of truth for `SUPPORTED_STYLES` and `normalizeStyle()` function
  - **Defense-in-Depth**: Four layers of style normalization prevent invalid style errors
  - **Schema Transform**: Zod schemas auto-normalize any style variant (oly→olympic_weightlifting, cf→crossfit) using **STRICT** `normalizeToStyle()` helper that throws errors for unsupported styles instead of silent fallback (documented duplicate in `shared/types/workouts.ts` to avoid circular imports)
  - **Route Middleware**: `normalizeStyleMiddleware` guarantees normalization on every request, sets `X-AXLE-Route` and `X-AXLE-Style-Normalized` headers
  - **Orchestrator Backstop**: Secondary normalization in orchestrator (WG-ORCH@1.0.5) with stamped logging `[WG] start { stamp, style, minutes, category, intensity }`
  - **Premium Guard**: Final validation in `generatePremiumWorkout()` multi-field extraction (style/goal/focus/meta.style) ensures only supported styles reach builders
  - **Friendly Errors**: Invalid styles throw structured errors `{code: 'style_unsupported', details: {received, normalized, supported}}` with clear context
  - **Debug Headers**: `X-AXLE-Route`, `X-AXLE-Style-Normalized`, `X-AXLE-Orchestrator`, `X-AXLE-Generator`, `X-AXLE-Style` for full tracing
  - **Entry Logging**: Premium generator logs `[PREMIUM] entry { style, seed, retryCount }` for complete visibility
  - **13 Supported Styles**: crossfit, olympic_weightlifting, powerlifting, bb_full_body, bb_upper, bb_lower, aerobic, conditioning, strength, endurance, gymnastics, mobility, mixed
  - **Strict Validation**: Schema enforces all 13 styles with no silent fallback - unsupported styles throw clear errors at validation time
- **Registry-First Architecture** (October 2025):
  - **Movement Selection**: 100% deterministic via pattern packs + movement registry (1,105 movements)
  - **AI Role**: Relegated to coaching notes generation only via `generateCoachingNotes()` helper
  - **System Prompt**: Cleaned of all movement pools and fallback ladders - AI prompt only requests coaching tips
  - **Builder Pattern**: `pickFromRegistry()` → build blocks → `generateCoachingNotes()` → return workout
  - **Commented Out**: Legacy MOVEMENT_POOLS and FALLBACK_LADDER definitions no longer used
  - **Refactored Builders**: `buildCrossFitCF` now uses registry-first pattern (matching `buildOly`)
- **Style-Specific Content Policies** (October 2025):
  - **Policy Enforcement**: Each workout style has strict content policies defined in `server/ai/config/stylePolicies.ts`
  - **Validation Rules**: Policies specify allowed categories, required patterns, banned exercises, loaded ratio requirements, and barbell-only restrictions
  - **Auto-Fix**: `tryAutoFixByPolicy()` attempts to auto-fix violations by swapping offending movements with compliant registry matches
  - **Error Handling**: Throws clear errors (`style_violation:reason`) when policies cannot be satisfied
  - **Olympic Weightlifting**: Requires barbell-only mains, must include at least one of [snatch, clean&jerk] patterns, bans DB snatch/thruster/burpee/etc
  - **Powerlifting**: Requires 85% loaded ratio, must include squat/bench/hinge patterns, bans thruster/burpee/double-under
  - **CrossFit**: Requires 60% loaded ratio, bans wall sit/star jump/high knees/jumping jacks
  - **Bodybuilding**: Requires 70% loaded ratio across full/upper/lower splits
  - **Applied in enrichWithMeta()**: Policies enforced after sanitization, before returning workout to user
- **Deterministic Generation**: `mulberry32` RNG + `strSeed(seed)` ensures reproducibility for workouts, with `meta.generator`, `meta.acceptance`, and `meta.seed` included.
- **Movement Service**: Integrates a comprehensive Movement Registry (1,105 movements across 9 categories) and pattern packs to intelligently select movements based on equipment, style, and constraints.
- **Workout Focus Categories**: Supports 13 workout focus types (e.g., CrossFit, Olympic Weightlifting, Powerlifting, Aerobic), each with specialized builder functions and hardness enforcement.
- **Equipment Normalization**: Aliases common equipment name variations (e.g., "dumbbells" to "dumbbell") to prevent generation failures.
- **Tightened Pattern Packs** (October 2025):
  - **Style-Only Movement Pools**: Each pattern pack now selects exclusively from its own category for main blocks (e.g., CrossFit only from `['crossfit']`, Olympic from `['olympic_weightlifting']`)
  - **Block Kind Specification**: All main blocks now explicitly declare their `kind` ('strength'|'conditioning'|'skill'|'aerobic'|'mobility')
  - **Style-Specific Structure**: Pattern packs define equipment requirements, loaded ratio requirements, and block patterns per style
  - **CrossFit**: E2:30 strength + EMOM conditioning, both from CrossFit category only
  - **Olympic Weightlifting**: Two E2:00 complexes (snatch; clean & jerk) + optional loaded EMOM accessory, all from Olympic category only
  - **Powerlifting**: E3:00 triples + E2:30 fives + E2:00 accessory superset, all from Powerlifting category only
  - **Bodybuilding**: Hypertrophy schemes (E2:30, E2:00, EMOM) from respective bb_* categories with 70% loaded ratio
  - **Aerobic**: INTERVALS from aerobic category, machines only, no loaded requirement
  - **Gymnastics**: Skill EMOMs and AMRAPs from gymnastics category, allows weighted pull-up variants
  - **Mobility**: MOBILITY_QUALITY from mobility category only
- **Duration Extraction** (October 2025):
  - **secondsFromPattern()** helper: Extracts exact durations from pattern titles ("EMOM 14" → 840s, "Every 2:30 x 5" → 750s) for precise header durations
  - **Warm-Up Rounding**: Warm-up item durations rounded to nearest 30s with 30s minimum for consistent UI display
  - **Applied in convertPremiumToGenerated()**: Ensures block headers and warm-up items have accurate, consistent durations
- **Hardness & Ratio Enforcement** (October 2025):
  - **Enhanced Hardness Scoring**: Pattern-specific bonuses for E2:00 (+0.38), E2:30 (+0.34), EMOM (+0.30); barbell presence adds +0.12 hardness
  - **Main Loaded Ratio Tracking**: Recomputes `main_loaded_ratio` post-substitution, tracking percentage of loaded movements in main blocks only (excludes warmup/cooldown)
  - **CrossFit Auto-Upgrade**: If CF loaded ratio < 60%, `autoUpgradeCFToLoaded()` swaps BW mains for loaded CrossFit movements from registry until 60% threshold met
  - **Applied in enrichWithMeta()**: Ratio computed after policy enforcement, auto-upgrade triggered for CrossFit if needed, final ratio stored in `meta.main_loaded_ratio`
- **Style Smoke Tests** (October 2025):
  - **CI-Friendly**: `scripts/smoke-styles.js` validates all 9 workout styles with fail-fast behavior
  - **Policy Checks**: time_fit, style_ok, main_loaded_ratio targets, required pattern presence, banned name detection
  - **Visibility**: Prints first 10 exercises and detailed policy check results for each style
  - **Exit Codes**: Returns 0 on success, 1 on any policy violation for CI/CD integration

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Users, workouts (with JSON exercise data), personal records, achievements. `WorkoutPlan` schema at `shared/workoutSchema.ts` serves as the single source of truth.

### Styling and Theming
- **Framework**: Tailwind CSS for utility-first styling
- **Theming**: CSS variables for dynamic light/dark mode
- **Design System**: Card-based UI with consistent spacing, typography, and a brand-optimized color palette.

### Development and Build Process
- **Structure**: Monorepo with shared types and schemas (`/shared`)
- **Build Tools**: Vite for client, esbuild for server
- **Development Environment**: Integrated Vite dev server with Express

### API Surface
- `GET /api/healthz`: Health and status check.
- `POST /api/workouts/generate`: Generates a full workout based on user inputs and an optional seed. **Hardened (WG-ORCH@1.0.2)**: Uses premium-only orchestrator with environment kill switches. All errors are converted to structured JSON with `code`, `hint`, and `details` fields before being passed to the error middleware. Returns 502 with `{ok: false, error: 'premium_failed:...', code: 'premium_failed', hint: '...', details: {...}}` when premium generation fails and kill switches are enabled. Emits debug headers when `DEBUG_PREMIUM_STAMP=1`.
- `POST /api/workouts/simulate`: Returns a validated `WorkoutPlan` based on focus, duration, intensity, equipment, and an optional seed (preview without database persistence). **Hardened (WG-ORCH@1.0.2)**: Same premium-only enforcement and structured error handling as `/generate`.
- `/api/workouts/suggest/today`: Provides a daily workout suggestion.

## External Dependencies

### UI and Component Libraries
- **Radix UI**: Accessible UI primitives
- **Lucide React**: Icon library
- **shadcn/ui**: Component library
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
- **OpenAI**: Premium workout generation
- **Seeded Random**: Deterministic workout generation

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
- **Sentry**: Error tracking
- **Pino-http**: HTTP request logging

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store
- **express-session**: Session middleware