# AXLE - Fitness Tracking Application

## Overview
AXLE is a mobile-first Progressive Web App (PWA) for comprehensive fitness tracking. It allows users to log workouts, track personal records, visualize achievements, and analyze fitness progress through an intuitive, mobile-optimized dashboard. The project aims to integrate a fine-tuned ML model for workout generation, focusing on business vision and market potential in the fitness technology sector.

## Recent Updates (November 2025)
- **CRITICAL PRODUCTION FIX** (Nov 20): Resolved Vercel serverless function module resolution failures causing 100% API downtime
  - **Root Cause**: Workout library used dynamic `fs.readFileSync()` which Vercel's file tracer cannot statically analyze
  - **Solution**: Refactored workout library to use static JSON imports instead of dynamic file reading
  - **Changes Made**:
    - Replaced `fs.readFileSync()` with `import warmupBlocksRaw from './blocks/warmup.json'` for all 6 block categories
    - Removed file system dependencies (fs, path, url) from workout library
    - Simplified `vercel.json` to use `includeFiles: "{server,lib,shared}/**"`
  - **Status**: ✅ Build passing locally, ready for Vercel deployment
  - **Next Step**: Deploy to Vercel preview and verify all endpoints work
- **PR Projections Enhancement**: Fixed critical bug where bodybuilding movements (Bench Press, Deadlift, Bicep Curl, etc.) were not recognized as weight-based, preventing PR projection calculations. Now all powerlifting, Olympic weightlifting, AND bodybuilding movements correctly show Epley Formula-based rep max projections.
- **Graph Visibility Improvements**: Enhanced visibility of workout analytics charts on stats overview page by increasing gradient opacity (30% → 80%) for workout activity graph and changing intensity levels graph to use accent color for better contrast.
- **Data Layer Fix**: Implemented production-grade handling of PostgreSQL numeric-to-string conversion with parseFloat transformation and NaN validation across PR projection pipeline.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite, Tailwind CSS.
- **Design**: Mobile-first, responsive, card-based UI using a brand-optimized color palette.
- **UI Components**: shadcn/ui (built on Radix UI), Lucide React for icons, cmdk for command palette.
- **State Management**: Zustand for client-side, TanStack Query for server-side data.
- **Error Handling**: Structured `HttpError` objects.
- **Key Features**: Unified PR charting, global unit preference system, enhanced group messaging, and comprehensive AXLE Reports with advanced visualizations (Training Load Chart, Enhanced Consistency Card, PR Sparklines Grid, Recovery Correlation Chart). Advanced analytics dashboards for PRs and Achievements, including visualizations for trends, distributions, and progress. Dynamic and interactive visualizations for health metrics (Physics Container, Multi-Layered Crystal, Organic Blob, L-System Procedural Tree) with sophisticated animations (anime.js) and real-time data binding.
- **PR Projections**: Epley Formula-based rep max projections for all weight-based movements (powerlifting, Olympic weightlifting, bodybuilding). Handles NULL rep_max values as 1RM with robust parseFloat data transformation.

### Backend Architecture
- **Server**: Express.js with a RESTful API in TypeScript.
- **Modularity**: Abstracted storage interface (`IStorage`).
- **API Validation**: Zod schemas for request validation.
- **Workout Generation**: OpenAI-first approach (gpt-4o-mini) leveraging a comprehensive movement registry for varied, style-specific, and equipment-aware programming. Includes mock workout fallback, creative titles, score types, and coaching cues. Timeout for OpenAI requests is set to 60 seconds.
- **API Surface**: Endpoints for health checks, workout generation, workout simulation, daily workout suggestions, and fetching personal records.

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Stores users, workouts (with JSON exercise data), personal records, achievements, and workout feedback. `WorkoutPlan` schema is the single source of truth. `axle_reports` table stores metrics/insights, and `profiles` table is extended for report delivery preferences.

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
- **Recharts**: Charting library for data visualization.
- **anime.js**: Animation engine for complex UI effects.

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