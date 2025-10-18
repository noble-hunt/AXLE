# AXLE - Fitness Tracking Application

## Overview
AXLE is a mobile-first Progressive Web App (PWA) for comprehensive fitness tracking. It enables users to log workouts, track personal records, visualize achievements, and analyze fitness progress through an intuitive, mobile-optimized dashboard. The project aims to integrate a fine-tuned ML model for workout generation, while maintaining a consistent UI and API schema.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite.
- **Design**: Mobile-first, responsive using Tailwind CSS; features a card-based UI with consistent spacing, typography, and a brand-optimized color palette.
- **UI Components**: shadcn/ui built on Radix UI, Lucide React for icons, cmdk for command palette.
- **State Management**: Zustand for client-side, TanStack Query for server-side data.
- **Error Handling**: Structured `HttpError` objects.

### Backend Architecture
- **Server**: Express.js with a RESTful API in TypeScript.
- **Modularity**: Abstracted storage interface (`IStorage`).
- **API Validation**: Zod schemas for request validation.
- **Workout Generation**: Features a three-tier fallback (premium → simple → mock) orchestrator with a registry-first architecture for deterministic movement selection. AI is primarily used for generating coaching notes. Includes premium-only enforcement via environment kill switches and multi-layer style normalization with strict validation and auto-normalization.
- **Deterministic Generation**: Uses `mulberry32` RNG and seeding for reproducible workouts.
- **Movement Service**: Integrates a comprehensive Movement Registry (1,105 movements) and pattern packs for intelligent movement selection based on equipment, style, and constraints.
- **Workout Focus Categories**: Supports 13 workout focus types (e.g., CrossFit, Olympic Weightlifting), each with specialized builders and hardness enforcement.
- **Style-Specific Content Policies**: Enforces strict content policies per workout style (e.g., required patterns, banned exercises, loaded ratio requirements) with auto-fix attempts.
- **Duration-Aware Pack Builders**: Dynamically adapts workout structures and block durations based on total time budget. Endurance workouts use equipment-aware modality picker (`pickCyclical`) to select the best available cardio tool (rower → bike → treadmill → ski erg → jump rope) and generate concrete, specific workout titles like "Cruise Intervals Row Z3–Z4" instead of generic "Bike/Row/Run". Equipment flows correctly from API request → workoutGenerator (context.equipment) → generatePremiumWorkout → buildEndurancePack → pickCyclical for deterministic modality selection.
- **Budget Fitting & Pattern Enforcement**: Scales main blocks to fit time budgets and enforces required patterns with auto-repair logic. The `extractMains()` helper correctly isolates main work blocks by excluding warm-up and cooldown sections, ensuring cyclical/loaded ratio calculations are accurate.
- **Hardness & Ratio Enforcement**: Scores workout hardness and tracks main loaded ratio, with auto-upgrades for CrossFit if needed. Endurance/aerobic workouts receive proper hardness credit based on time in main work, pattern type (VO2/cruise/steady), and intensity level, ensuring they pass hardness floor checks.

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Stores users, workouts (with JSON exercise data), personal records, and achievements. `WorkoutPlan` schema is the single source of truth.

### Development and Build Process
- **Structure**: Monorepo with shared types and schemas.
- **Build Tools**: Vite for client, esbuild for server.
- **Development Environment**: Integrated Vite dev server with Express.

### API Surface
- `GET /api/healthz`: Health check.
- `POST /api/workouts/generate`: Generates a full workout based on user inputs. Uses premium-only orchestrator with structured error handling.
- `POST /api/workouts/simulate`: Returns a validated `WorkoutPlan` preview without persistence, with similar enforcement as `/generate`.
- `/api/workouts/suggest/today`: Provides a daily workout suggestion.

## External Dependencies

### UI and Component Libraries
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.
- **shadcn/ui**: Component library.
- **class-variance-authority**: Variant-based component APIs.
- **cmdk**: Command palette.

### State Management and Data Fetching
- **TanStack Query**: Server state management.
- **Zustand**: Client-side state management.

### Database and ORM
- **Drizzle ORM**: Type-safe database toolkit.
- **Neon Database**: Serverless PostgreSQL.
- **Drizzle Kit**: Database migration and introspection.

### AI and Generation
- **OpenAI**: Premium workout generation.
- **Seeded Random**: Deterministic workout generation.

### Development and Build Tools
- **Vite**: Fast build tool and dev server.
- **esbuild**: Fast JavaScript bundler.
- **PostCSS**: CSS processing.
- **TypeScript**: Static type checking.

### Utility Libraries
- **date-fns**: Date manipulation.
- **clsx/tailwind-merge**: Conditional CSS classes.
- **nanoid**: Unique ID generation.
- **react-hook-form**: Form state management.
- **zod**: Schema validation.

### Monitoring and Observability
- **Sentry**: Error tracking.
- **Pino-http**: HTTP request logging.

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store.
- **express-session**: Session middleware.