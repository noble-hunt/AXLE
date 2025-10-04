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
- **Workout Generation**: Three-tier fallback (premium → simple → mock) orchestrator. The premium generator uses AI for CrossFit/HIIT workouts, enforcing pattern locks, hardness floors, and preventing banned bodyweight movements when equipment is available.
- **Deterministic Generation**: `mulberry32` RNG + `strSeed(seed)` ensures reproducibility for workouts, with `meta.generator`, `meta.acceptance`, and `meta.seed` included.
- **Movement Service**: Integrates a comprehensive Movement Registry (1,105 movements across 9 categories) and pattern packs to intelligently select movements based on equipment, style, and constraints.
- **Workout Focus Categories**: Supports 13 workout focus types (e.g., CrossFit, Olympic Weightlifting, Powerlifting, Aerobic), each with specialized builder functions and hardness enforcement.
- **Equipment Normalization**: Aliases common equipment name variations (e.g., "dumbbells" to "dumbbell") to prevent generation failures.

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
- `POST /api/workouts/generate`: Generates a full workout based on user inputs and an optional seed.
- `POST /api/workouts/preview`: Returns a validated `WorkoutPlan` based on focus, duration, intensity, equipment, and an optional seed.
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