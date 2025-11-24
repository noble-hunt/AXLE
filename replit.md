# AXLE - Fitness Tracking Application

## Overview
AXLE is a mobile-first Progressive Web App (PWA) for comprehensive fitness tracking, enabling users to log workouts, track personal records, visualize achievements, and analyze fitness progress. The project aims to integrate a fine-tuned ML model for workout generation, targeting significant market potential in the fitness technology sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite, and Tailwind CSS.
- **Design Principles**: Mobile-first, responsive, and card-based UI with a brand-optimized color palette. Optimized for iPhone 15 (393px width) with iOS 8-point grid system (8, 16, 24, 32, 44px) and iOS HIG-compliant touch targets (≥44×44px minimum).
- **UI Components**: Leverages shadcn/ui (Radix UI), Lucide React for icons, and cmdk for a command palette. Swift Card component uses p-7 (28px) base padding, with p-8 (32px) for emphasized cards. Chip component offers sizes from h-6 (24px) to h-11 (44px) for touch-friendly interactions.
- **State Management**: Uses Zustand for client-side state and TanStack Query for server-side data synchronization.
- **Error Handling**: Implements structured `HttpError` objects.
- **Key Features**: Unified Personal Record (PR) charting, global unit preference system, enhanced group messaging, and comprehensive AXLE Reports with advanced visualizations (Training Load Chart, Enhanced Consistency Card, PR Sparklines Grid, Recovery Correlation Chart). Advanced analytics dashboards provide visualizations for PR trends and progress. Dynamic and interactive visualizations for health metrics are implemented with sophisticated animations (anime.js) and real-time data binding.
- **Calendar Feature**: Comprehensive calendar view with Today/Calendar dual-tab interface. Today tab displays current day's full detail (workouts, 8 health metrics, heart rate chart, AI insights). Calendar tab shows month grid with day cards featuring quick metrics (workout count, sleep hours, vitality score) using pastel-colored metric indicators. Implements smart back-button navigation in TopAppBar (day detail → calendar → home). Critical UTC timezone handling in backend ensures workouts appear on correct calendar dates. DayDetailContent component shared between Today tab and day detail pages for UI consistency.
- **PR Projections**: Employs Epley Formula-based rep max projections for all weight-based movements.
- **Mobile Optimization**: Systematic UI sizing increases (Nov 2024) across 20+ files improved mobile usability: card padding increased by one step (p-4→p-5, p-6→p-7), spacing expanded proportionally (gap-3→gap-4, space-y-3→space-y-4), ensuring comfortable touch targets and better screen utilization on modern iPhones.

### Backend Architecture
- **Server**: Express.js with a RESTful API, developed in TypeScript.
- **Modularity**: Features an abstracted storage interface (`IStorage`).
- **API Validation**: Utilizes Zod schemas for robust request validation.
- **Workout Generation**: Implements an OpenAI-first approach (gpt-4o-mini) for varied, style-specific, and equipment-aware workout programming, supported by a comprehensive movement registry. Includes mock workout fallbacks, creative titles, score types, and coaching cues.
- **API Surface**: Provides endpoints for health checks, workout generation, workout simulation, daily workout suggestions, fetching personal records, and calendar data (month summaries and day details). Calendar endpoints use UTC date normalization (formatDateUTC, getWorkoutDateStr helpers) to prevent timezone boundary issues.
- **Freeform Workout Logging**: Robust transformer with array validation, comprehensive repScheme fallbacks (handles AMRAP/EMOM edge cases), and smart duration estimation. Uses Drizzle ORM DAL for database layer consistency.

### Data Layer
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **Schema**: Stores user data, workouts (with JSON exercise data), personal records, achievements, workout feedback, AXLE reports, and extended profiles for report delivery preferences.

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
- **OpenAI GPT-4o Mini**: Workout generation (gpt-4o-mini) and audio transcription (gpt-4o-mini-transcribe for 50% cost savings vs Whisper-1).
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