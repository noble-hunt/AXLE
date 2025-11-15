# AXLE - Fitness Tracking Application

## Overview
AXLE is a mobile-first Progressive Web App (PWA) for comprehensive fitness tracking. It enables users to log workouts, track personal records, visualize achievements, and analyze fitness progress through an intuitive, mobile-optimized dashboard. The project aims to integrate a fine-tuned ML model for workout generation.

## Recent Changes (November 15, 2025)
- **Replaced Training Identity Gem with Multi-Layered Crystal**: Completely redesigned the crystal visualization following anime.js homepage style with 3 nested SVG polygons (7 vertices each), 12 glowing vertex points that pulse based on streakDays (scale 1→1.5, intensity-driven), and 20 orbiting particles with staggered circular motion (36 keyframes, 8s orbit). Features: parallax rotation (20s/30s/25s), gradient morphing (red↔blue for strength/cardio ratios), and glassmorphism blur filter on middle layer. All animations coordinated with proper cleanup and responsiveness to slider changes.

## Recent Changes (November 14, 2025)
- **Added Polish Features to Health Viz Playground**: Implemented 5 polish features for enhanced UX: (1) FPS counter (requestAnimationFrame-based, top-right corner), (2) Debounced sliders (300ms delay, immediate UI feedback with dual-state pattern), (3) Random Workout Pattern button (adds 10 workouts over 3 seconds), (4) Reset Animations button (restarts tracked timelines), (5) Page Visibility API (pauses/resumes animations on tab switch). All features functional with proper test coverage. Known limitation: Reset and Page Visibility only affect 3 tracked timelines, not all ~20 looping animations; full coverage would require AnimationManager refactor.
- **Implemented L-System Procedural Tree Visualization**: Added Growing Tree component to Health Viz Playground using procedural L-System generation (rule: "F" → "F[+F]F[-F]F"). Each 'F' command creates a separate SVG branch segment for proper recursive branching. Features: mirrored root system (scaled 0.3x, capped at y=118), leaves positioned at branch endpoints (limited by goodSleepNights), coordinated anime.js timeline (branches → roots → leaves → wind sway), and graceful degradation when anime.js unavailable. Fixed critical rendering bug by decoupling SVG visibility from animation library loading, ensuring tree renders in all environments (test, offline, CDN failures).

## Recent Changes (November 13, 2025)
- **Fixed OpenAI Timeout Issue**: Resolved production-critical bug where workout generation was failing due to 30-second timeout. Increased OpenAI timeout to 60 seconds in both `server/workoutGenerator.ts` and `server/lib/openai.ts`. Added proper timeout configuration (`timeout: 60000, maxRetries: 2`) to OpenAI client initialization.
- **Fixed Advanced Insights Section**: Resolved bug where advanced visualizations (Training Load, Enhanced Consistency, PR Sparklines, Recovery Correlation) weren't rendering in report detail modals. Backend now returns empty arrays instead of `undefined` for visualization fields, ensuring all chart components render with proper empty states.
- **Added Report Type Export**: Added `Report` type alias to `shared/schema.ts` for convenient frontend imports.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite, Tailwind CSS.
- **Design**: Mobile-first, responsive, card-based UI with consistent spacing, typography, and a brand-optimized color palette.
- **UI Components**: shadcn/ui (built on Radix UI), Lucide React for icons, cmdk for command palette.
- **State Management**: Zustand for client-side, TanStack Query for server-side data.
- **Error Handling**: Structured `HttpError` objects.
- **Key Features**: Unified PR charting, global unit preference system, enhanced group messaging with proper author names, and a comprehensive AXLE Reports feature with advanced visualizations (Training Load Chart, Enhanced Consistency Card, PR Sparklines Grid, Recovery Correlation Chart).

### Backend Architecture
- **Server**: Express.js with a RESTful API in TypeScript.
- **Modularity**: Abstracted storage interface (`IStorage`).
- **API Validation**: Zod schemas for request validation.
- **Workout Generation**: OpenAI-first approach (gpt-4o-mini) using a comprehensive movement registry (~90 movements) for varied, style-specific programming. Features equipment-aware filtering, high temperature (0.9) for variety, and a mock workout fallback. All categories include appropriate exercise volumes, cardio distance/calorie requirements, and weight specifications. Workouts feature creative titles, score types, and coaching cues with scaling suggestions.
- **API Surface**: Includes endpoints for health checks (`/api/healthz`), workout generation (`/api/workouts/generate`), workout simulation (`/api/workouts/simulate`), and daily workout suggestions (`/api/workouts/suggest/today`).

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Stores users, workouts (with JSON exercise data), personal records, and achievements. `WorkoutPlan` schema is the single source of truth.
- **AXLE Reports Schema**: `axle_reports` table for metrics/insights, `profiles` table extended for report frequency, delivery day/time, and notification toggles.

### Development and Build Process
- **Structure**: Monorepo with shared types and schemas.
- **Build Tools**: Vite for client, esbuild for server.
- **Development Environment**: Integrated Vite dev server with Express.

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
- **OpenAI**: Workout generation.
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

### Production Deployment
- **Vercel Pro**: Production hosting.
- **Supabase Storage**: User avatar uploads.