# AXLE - Fitness Tracking Application

## Overview

AXLE is a modern, mobile-first Progressive Web App (PWA) for comprehensive fitness tracking. Its core purpose is to enable users to log workouts, track personal records, visualize achievements, and analyze fitness progress through detailed reports. The application offers a clean, intuitive interface with a comprehensive dashboard, optimized for mobile devices, supporting a holistic approach to fitness management. The project aims to eventually integrate a fine-tuned ML model for workout generation while maintaining a consistent UI/API schema.

## Recent Changes

### Workout Metadata Enhancement - selectionTrace & Acceptance Flags (October 2025)
Enhanced workout generation metadata with comprehensive tracing and validation flags for debugging, testing, and quality assurance:
- **Registry ID Tagging** (`enrichWithMeta()` in `server/ai/generators/premium.ts`):
  - All workout items now tagged with `registry_id` by looking up exercise names in the movement registry
  - Enables precise movement tracking and validation throughout the generation pipeline
  - Supports fuzzy matching for complex exercise names (e.g., "Barbell Front Squat (A1)" → "front-squat")
- **Selection Trace** (`workout.meta.selectionTrace`):
  - Complete audit trail showing every block with movement registry IDs
  - Each trace entry includes: block title, kind (warmup/strength/conditioning/skill/cooldown), time_min, and items array
  - Items array contains: movement name and registry_id for full traceability
  - Example: `{title: "Every 2:30 x 5", kind: "strength", items: [{name: "Barbell Front Squat (A1)", id: "front-squat"}]}`
- **Comprehensive Acceptance Flags** (`workout.meta.acceptance`):
  - `time_fit`: Validates total duration within ±10% of requested duration
  - `has_warmup`: Confirms warm-up block ≥6 minutes present
  - `has_cooldown`: Confirms cool-down block ≥4 minutes present
  - `style_ok`: Validates style exists in pattern packs configuration
  - `hardness_ok`: Ensures workout hardness meets pack-specific floor (0.85 CF/Oly/PL/BB, 0.70 aerobic, 0.40 mobility)
  - `equipment_ok`: Validates no exercises require missing equipment
  - `no_banned_in_mains`: Confirms no banned bodyweight movements in main blocks when equipment available
  - `mixed_rule_ok`: For mixed focus, validates correct number of blocks per category
  - `injury_safe`, `readiness_mod_applied`, `patterns_locked`: Standard quality checks
- **Top-Level Meta Bubble** (`server/routes.ts` and `server/workoutGenerator.ts`):
  - Workout meta now available at both `workout.meta` and top-level `meta` in API responses
  - Includes: generator, style, goal, title, equipment, seed, acceptance, selectionTrace
  - Consistent metadata structure across all generation paths (premium/simple/mock)
- **Benefits**: Full reproducibility (same seed + inputs = same workout + same trace), regression testing support, debugging transparency, quality assurance validation

### MovementService Integration (October 2025)
Integrated the comprehensive Movement Registry and pattern packs into the premium workout generator to replace hardcoded movement pools with intelligent, constraint-aware movement selection:
- **Movement Registry**: 1,105 movements across 9 categories with metadata (equipment, patterns, modality, difficulty)
- **Pattern Packs Configuration** (`server/ai/config/patternPacks.ts`): Defines unique workout structures for each of the 9 workout categories
  - Each pack specifies main block patterns (E2:00x, EMOM, AMRAP, etc.), movement selection criteria, hardness floors, and timing
  - Supports category-specific constraints (requireLoaded, modality filtering, pattern matching)
- **pickMovements() Helper** in `server/ai/generators/premium.ts`: Uses MovementService to query movements with:
  - Equipment filtering based on user availability
  - Pattern and category constraints from pattern packs
  - Modality filtering (strength, conditioning, skill, aerobic, mobility)
  - Automatic bannedMain exclusion for quality control
  - Loaded movement requirements when equipment is available
- **Registry-Based Validation** (`findMovement()` in `server/ai/movementService.ts`):
  - Lookup movements by name with fuzzy matching (direct, alias, partial)
  - Used by `computeHardness()` and `sanitizeWorkout()` for metadata-based scoring
- **Hardness Computation** (`computeHardness()` in `server/ai/generators/premium.ts`):
  - Uses movement metadata instead of string matching
  - +0.10 bonus for external load (barbell/dumbbell/kettlebell/machine/sandbag/sled)
  - +0.08 bonus for Olympic patterns (olympic_snatch, olympic_cleanjerk)
  - +0.06 bonus for heavy compounds (squat/hinge/bench with external load)
  - −0.10 penalty when ≥2 bodyweight movements in main blocks while equipment is available
- **Sanitization** (`sanitizeWorkout()` in `server/ai/generators/premium.ts`):
  - Checks `movement.banned_in_main_when_equipment` flag from registry
  - Rotation system: DB Box Step-Overs → KB Swings → Wall Balls → Burpees
  - Enforces pack-specific hardness floors (≥0.85 for CF/Oly/PL/BB with gear, 0.70 aerobic, 0.40 mobility)
  - Telemetry logging: Summarizes style, hardness, floors, and banned replacements made
- **Deterministic Sampling** (`generatePremiumWorkout()` in `server/ai/generators/premium.ts`):
  - Seed propagation ensures same input + same seed = same workout
  - Meta object includes: `generator`, `style`, `seed`, and `selectionTrace` (movements and filters per block)
  - Console telemetry logs pools/filters used for debugging and reproducibility
- **Integration Points**: Premium generator now imports `PACKS`, `queryMovements`, and `findMovement` for deterministic, category-appropriate workout generation
- **Benefits**: Replaces static movement arrays with dynamic, constraint-aware selection; ensures style fidelity; metadata-driven validation; supports all 13 workout focus types

### Expanded Workout Focus Categories (October 2025)
Extended workout generator with 13 comprehensive workout focus types and improved UX:
- **Categories**: Added 9 specialized categories beyond the 4 primary types (Strength, Conditioning, Mixed, Endurance)
  - CrossFit: Classic CF patterns (EMOM/AMRAP/For Time)
  - Olympic Weightlifting: Snatch & C&J complexes
  - Powerlifting: Squat/Bench/Deadlift focus
  - Bodybuilding: Full Body, Upper, Lower splits
  - Aerobic (Cardio): Z2–Z4 intervals or steady state
  - Gymnastics Work: Skill EMOMs (TTB, MU, HS, strict pull)
  - Mobility Session: Quality mobility & tissue work
- **Type System**: Created shared `WorkoutFocus` type in `client/src/types/workouts.ts` used across wizard and API
- **UI Enhancement**: ArchetypeStep displays 4 primary cards + "More" button that opens a Sheet/modal with 9 additional categories
- **Implementation**: Sheet component from swift UI library for mobile-friendly category selection
- **Server Routing**: Added `resolveStyle()` function in `server/workoutGenerator.ts` to map all new focuses to premium generator with appropriate style keys
  - All new workout types route to premium engine with specific style parameter
  - Updated `WorkoutPlanZ` schema to accept all 13 focus types
  - Updated API validation in `server/routes/workouts.ts` to accept new focus types
- **Style-Aware Builders**: Implemented specialized builder functions in `server/ai/generators/premium.ts` for deterministic workout generation
  - `buildCrossFitCF`: Every 2:30 x 5 strength + EMOM 14-16 conditioning + optional 21-15-9 finisher
  - `buildOly`: Barbell warm-up complex + E2:00 x 7 snatch complex + E2:00 x 7 C&J complex + accessory EMOM 10
  - `buildPowerlifting`: Heavy lift A (5x3 @ 85-90%) + Volume lift B (4x5-6 @ 75-82%) + accessory superset
  - `buildBBFull/Upper/Lower`: Hypertrophy-focused tri-sets/supersets with 8-15 rep ranges + metabolite finisher
  - `buildAerobic`: Z3/Z4 intervals (5x4:00 or 10x1:00) + optional easy skill EMOM
  - `buildGymnastics`: Skill EMOM 16 (HS/strict pull-ups) + AMRAP 8 quality core (TTB/L-sits)
  - `buildMobility`: Dynamic warm-up + 2 mobility circuits + PNF contract-relax + breathing cooldown
  - Each builder enforces appropriate hardness floors (0.85 for equipment-based, lower for recovery/aerobic)
  - Pattern compliance built into builders (no validation needed post-generation)

### Equipment Normalization (October 2025)
Fixed workout generation failures caused by equipment name mismatches. Implemented explicit equipment alias mapping in `server/workouts/generate.ts`:
- **Issue**: User input variations like "dumbbells" (plural) and "pull_up_bar" (underscore) didn't match canonical movement catalog IDs ("dumbbell", "pullup-bar"), causing empty workout blocks
- **Solution**: Added `EQUIPMENT_ALIASES` map with deterministic mappings for plural forms (dumbbells→dumbbell, kettlebells→kettlebell, barbells→barbell) and underscore variants (pull_up_bar→pullup-bar, dip_bar→dip-bar)
- **Impact**: Workout generation now reliably finds matching movements for common equipment name variations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite
- **Design**: Mobile-first, responsive using Tailwind CSS
- **UI Components**: shadcn/ui built on Radix UI
- **State Management**: Zustand for client-side (local persistence), TanStack Query for server-side (data fetching, caching)
- **Error Handling**: `client/src/lib/http.ts` for structured `HttpError`

### Backend Architecture
- **Server**: Express.js with a RESTful API in TypeScript
- **Modularity**: Abstracted storage interface (`IStorage`)
- **API Validation**: Zod schemas
- **Workout Generation**: Three-tier fallback (premium → simple → mock) with an orchestrator. Premium generator uses OpenAI for CrossFit/HIIT workouts, enforces pattern locks, hardness floors, and prevents banned bodyweight movements when equipment is available.

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Users, workouts (with JSON exercise data), personal records, achievements. `WorkoutPlan` schema at `shared/workoutSchema.ts` is the single source of truth, shared by client and server.

### Deterministic Generation
- `mulberry32` RNG + `strSeed(seed)` ensures reproducibility for workouts, used for QA. All workouts include `meta.generator`, `meta.acceptance`, and `meta.seed`.

### Styling and Theming
- **Framework**: Tailwind CSS for utility-first styling
- **Theming**: CSS variables for dynamic light/dark mode
- **Design System**: Card-based UI with consistent spacing, typography, and a brand-optimized color palette.

### Development and Build Process
- **Structure**: Monorepo with shared types and schemas (`/shared`)
- **Build Tools**: Vite for client, esbuild for server
- **Development Environment**: Integrated Vite dev server with Express

### API Surface

#### Health & Status
- `GET /api/healthz` → `{ ok: true, uptime, version, env }`

#### Workout Generation
- `POST /api/workouts/generate`: Generates a full workout based on goal, duration, intensity, equipment, and an optional seed.
- `POST /api/workouts/preview`: Returns a validated `WorkoutPlan` based on focus, duration, intensity, equipment, and an optional seed.

#### Suggestions
- `/api/workouts/suggest/today`: Provides a daily workout suggestion.

### Premium Workout Generator Features
- **Pattern Lock System**: Enforces specific CrossFit/HIIT patterns (E3:00/E4:00, EMOM, AMRAP, For Time, Chipper) for main blocks, with automatic regeneration on failure.
- **Banned Bodyweight Movements**: Prevents specific bodyweight movements in main blocks when equipment is available.
- **Hardness Floor Enforcement**: Ensures workout difficulty meets minimum thresholds based on equipment and user readiness, injecting finishers if needed.
- **Intensity Upgrader**: A post-generation enhancement that rotates banned movements, tightens time domains, and scales reps to increase workout intensity.
- **Strict Mixed Semantics**: For 'mixed' focus, enforces a deterministic block structure (e.g., Strength → Conditioning → Skill) with equipment-aware exercise selection.
- **Meta Tracing**: Includes `meta.generator`, `meta.acceptance`, and `meta.seed` for transparency and reproducibility.

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
- **Sentry**: Error tracking for client and server
- **Pino-http**: HTTP request logging

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store
- **express-session**: Session middleware