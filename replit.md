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
- **Workout Generation (Simplified OpenAI-First)**: Simplified architecture using direct OpenAI generation with movement registry context for maximum variety and style-specific programming.
  - **OpenAI-First Approach**: Calls OpenAI (gpt-4o-mini) directly with comprehensive movement library (~90 movements) and style-specific instructions for fast, cost-effective generation
  - **Movement Registry**: Curated movement library at `server/workouts/movements.ts` with ~90 movements tagged by equipment, body region, and movement pattern
  - **Equipment-Aware Filtering**: Automatically filters movement library based on user's available equipment
  - **Style-Specific Programming**: Prompt engineering guides OpenAI to follow proper methodology for each style (CrossFit AMRAPs/EMOMs, Olympic Weightlifting focus on cleans/snatches, Powerlifting emphasis on squat/bench/deadlift, etc.)
  - **High Temperature (0.9)**: Configured for maximum workout variety - each generation produces unique programming
  - **Fallback**: Falls back to mock workout if OpenAI fails (mock generator only used as last resort)
  - **Recent Changes (Oct 21, 2025)**: 
    - **Exercise Volume Requirements Added**: ALL categories now require appropriate exercise counts (warm-up: 3-5 exercises, cool-down: 3-4 exercises, main: 3-7 exercises depending on category) based on user-provided workout examples
    - **Cardio Distance/Calorie Requirements**: ALL cardio (Row, Bike, Run, Ski) MUST include distance in meters or calories (e.g., "500m Row", "15 Cal Bike", "800m Run")
    - **Weight Specifications**: ALL weighted movements MUST include M/F weight in format "@ weight_male/weight_female" (e.g., "KB Swing @ 24/16kg", "Wall Ball @ 20/14lb", "DB @ 50/35lb")
    - **HYROX-Style Endurance**: Endurance category specifically generates HYROX training workouts with alternating cardio + functional movements
    - **Powerlifting**: Main section now requires 4-6 exercises (primary lift + secondary compound + accessories) instead of just 1
    - **Olympic Weightlifting**: Main section requires 5-7 exercises with percentage-based programming (Oly lifts + squats + pulling + accessories)
    - **Bodybuilding Upper**: Main section requires 4-6 exercises with detailed set/rep schemes ("4x8 Each Side - Heavy")
    - **All Other Categories**: Updated with category-appropriate exercise volume requirements
    - **Wodify-Style Enhancements Applied to ALL Categories**: Every workout category now features creative workout titles (ALL CAPS with quotes), appropriate score types, and coaching cues with embedded scaling suggestions
    - **Categories Enhanced**: CrossFit, Olympic Weightlifting, Powerlifting, Strength, Endurance/HYROX, Conditioning, Gymnastics, Bodybuilding (Upper/Lower/Full Body), Mobility, Aerobic, Mixed
    - **Exercise Display Improved**: UI now shows "15 Air Squats" format instead of "sets x reps" display
    - **Speed Optimization**: Switched from gpt-4o to gpt-4o-mini for 2-3x faster generation
    - Removed complex deterministic builders (buildCrossFitCF, buildOly, buildPowerlifting, etc.) that were causing routing bugs (Oct 20)
    - Eliminated triple normalization bug by removing premium generator routing layer (Oct 20)
    - Simplified from 3-tier fallback (premium → simple → mock) to OpenAI-first (OpenAI → mock) (Oct 20)

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