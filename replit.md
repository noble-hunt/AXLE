# AXLE - Fitness Tracking Application

## Recent Production Deployment Fixes (Nov 21, 2025)
**Issue**: Complete production failure - all endpoints returning 500 errors, no data loading  
**Root Cause**: Stale committed `server/**/*.js` build artifacts missing `with { type: 'json' }` import assertions  
**Solution**:
1. ✅ Added `includeFiles: "{server,shared}/**"` to vercel.json to bundle server files in serverless function
2. ✅ Fixed buildCommand to fail on TypeScript errors (removed `|| true` guard)
3. ✅ Added server/shared .js files to .gitignore - build artifacts now generated fresh on each deploy
4. ✅ Removed `require()` call from api/index.ts for ESM compatibility  
**Status**: Vercel build now generates fresh .js files with proper ESM import assertions on each deployment

## Overview
AXLE is a mobile-first Progressive Web App (PWA) designed for comprehensive fitness tracking. Its core purpose is to enable users to log workouts, track personal records, visualize achievements, and analyze fitness progress through an intuitive, mobile-optimized dashboard. The project's vision includes integrating a fine-tuned ML model for workout generation, targeting significant market potential in the fitness technology sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite, and Tailwind CSS.
- **Design Principles**: Mobile-first, responsive, and card-based UI utilizing a brand-optimized color palette.
- **UI Components**: Leverages shadcn/ui (built on Radix UI), Lucide React for icons, and cmdk for a command palette.
- **State Management**: Uses Zustand for client-side state and TanStack Query for server-side data synchronization.
- **Error Handling**: Implements structured `HttpError` objects for consistent error management.
- **Key Features**: Includes unified Personal Record (PR) charting, a global unit preference system, enhanced group messaging, and comprehensive AXLE Reports with advanced visualizations (Training Load Chart, Enhanced Consistency Card, PR Sparklines Grid, Recovery Correlation Chart). Advanced analytics dashboards provide visualizations for PR trends, distributions, and progress. Dynamic and interactive visualizations for health metrics are implemented with sophisticated animations (anime.js) and real-time data binding.
- **PR Projections**: Employs Epley Formula-based rep max projections for all weight-based movements, handling NULL rep_max values and robust data transformations.

### Backend Architecture
- **Server**: Express.js with a RESTful API, developed in TypeScript.
- **Modularity**: Features an abstracted storage interface (`IStorage`).
- **API Validation**: Utilizes Zod schemas for robust request validation.
- **Workout Generation**: Implements an OpenAI-first approach (gpt-4o-mini) for varied, style-specific, and equipment-aware workout programming, supported by a comprehensive movement registry. Includes mock workout fallbacks, creative titles, score types, and coaching cues.
- **API Surface**: Provides endpoints for health checks, workout generation, workout simulation, daily workout suggestions, and fetching personal records.

### Data Layer
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **Schema**: Stores user data, workouts (with JSON exercise data), personal records, achievements, and workout feedback. The `WorkoutPlan` schema serves as the single source of truth. `axle_reports` table stores metrics and insights, and the `profiles` table is extended for report delivery preferences.

### Development and Build Process
- **Structure**: Monorepo architecture with shared types and schemas.
- **Build Tools**: Vite for client-side and esbuild for server-side compilation.
- **Development Environment**: Integrates a Vite development server with Express.

## External Dependencies

### UI and Component Libraries
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.
- **shadcn/ui**: Component library.
- **class-variance-authority**: Variant-based component APIs.
- **cmdk**: Command palette.
- **Recharts**: Charting library.
- **anime.js**: Animation engine.

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
- **Vite**: Build tool and dev server.
- **esbuild**: JavaScript bundler.
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