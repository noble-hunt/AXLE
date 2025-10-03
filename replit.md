# AXLE - Fitness Tracking Application

## Overview

AXLE is a modern, mobile-first Progressive Web App (PWA) for comprehensive fitness tracking. Its core purpose is to enable users to log workouts, track personal records, visualize achievements, and analyze fitness progress through detailed reports. The application offers a clean, intuitive interface with a comprehensive dashboard, optimized for mobile devices, supporting a holistic approach to fitness management. The project aims to eventually integrate a fine-tuned ML model for workout generation while maintaining a consistent UI/API schema.

## Recent Changes

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