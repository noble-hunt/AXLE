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
- **PR Chart Display (Nov 2, 2025)**: 
  - Unified chart implementation - each movement shows a single "All PR History" chart
  - Removed duplicate rep-max-specific charts (previously showed separate 1RM/3RM/5RM/10RM charts)
  - Color-coded dots differentiate rep max variants on the unified chart (Red=1RM, Orange=3RM, Yellow=5RM, Green=10RM)
  - Chart shows all PR entries sorted chronologically, with "{count} total entries" subtitle
- **Unit Preference System (Nov 2, 2025)**:
  - Moved unit preference (lbs/kg) from PRs page to global profile setting
  - Added `preferredUnit` field to profiles table (defaults to "lbs")
  - Users can set their preferred weight unit in Edit Profile page
  - PRs page automatically uses profile preference for all PR displays and entries
  - Removed per-page unit toggles for consistent, user-centric experience
- **Group Messaging Fix (Nov 3, 2025)**:
  - Fixed critical bug where group messages displayed email addresses or "User" instead of proper author names
  - Updated GroupPost type to include full author metadata (authorFirstName, authorLastName, authorUsername, authorAvatarUrl)
  - Changed fetchGroupPosts to use `/api/groups/:id/feed` endpoint which joins with profiles table for author data
  - Updated sendPost to insert into posts table, link to group, then refetch from feed endpoint using database timestamps to get complete author info
  - Enhanced dbRowToPost to handle both feed format (new) and legacy mutation format (old) for backward compatibility
  - Added temporary post ID skip logic in reactions endpoint to prevent UUID validation errors
  - Group feed now displays proper author names ("Hunter Noble") instead of fallback values
- **Group Feed UI Fixes (Nov 3, 2025)**:
  - Fixed virtual scrolling overlap: Increased estimateSize from 100px to 250px to match actual card heights (~250-300px)
  - Added dynamic measureElement callback for precise height measurement of posts with variable content
  - Fixed spacing between messages: Added pb-3 padding to wrapper divs (space-y doesn't work with virtual scrolling absolute positioning)
  - Fixed nudge card localStorage bug: Card now correctly shows only once per 24 hours (was showing on every page load for empty feeds)
  - Reduced card padding from p-4 md:p-5 to p-3 for better mobile UX
  - Converted Edit Group form from inline display to modal Dialog overlay to prevent blocking message view
  - Edit Group button now opens a scrollable modal (max-h-90vh) instead of replacing the feed UI
  - **CRITICAL**: Edit Group modal now properly populates form fields on open (calls startEditingGroup) and resets on close (calls cancelEditingGroup)
- **Group Message Author Name Fix (Nov 5, 2025)**:
  - Fixed critical bug where newly sent messages displayed user's email address instead of proper name
  - Updated optimistic post creation to use profile data (firstName, lastName, username) with proper fallback chain
  - Fallback order: "First Last" → "First" → "Last" → username → email prefix (not full email) → "You"
  - Matches name display pattern used throughout app (profile.tsx)
  - Email addresses no longer appear as author names in group feeds
- **AXLE Reports Feature (Nov 13, 2025)**:
  - Comprehensive weekly/monthly fitness reporting system with automated generation and delivery
  - **Database Schema**: Added `axle_reports` table with metrics/insights JSON storage, timeframe tracking, and delivery status
  - **Report Preferences**: Extended profiles table with report frequency (none/weekly/monthly/both), delivery day selection (0-6 for weekly, 1-31 for monthly), delivery time, and notification toggles
  - **Backend Services**: ReportGenerator service calculates workout volume, PR progression, consistency metrics, and generates personalized insights
  - **API Endpoints**: 
    - `GET /api/reports` - List user's report history with filters
    - `GET /api/reports/:id` - Get detailed report with auto mark-as-viewed
    - `POST /api/reports/generate` - Manual report generation
    - `PATCH /api/profiles/report-preferences` - Update report settings
  - **Frontend Components**:
    - Reports page (`/reports`) with history list, generate button, and preferences access
    - ReportDetailModal with hero summary, KPI grid, insights display, and share functionality
    - ReportPreferencesSheet with frequency selection, day pickers, notification toggles, and time selection
  - **Critical Fixes**:
    - Fixed backend/frontend schema mismatch for enableNotifications and enableEmail fields
    - Corrected field name inconsistency (weeklyReportDay → reportWeeklyDay, monthlyReportDay → reportMonthlyDay)
    - Implemented null value preservation to respect backend refinement contract (sends null for non-selected frequencies)
    - Expanded monthly day range to 1-31 to match backend schema
  - **Future Enhancements**: Planned visualizations (workout volume bar chart, PR timeline, consistency heatmap using recharts)

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

## Production Deployment (Nov 5, 2025)

### Deployment Platform
- **Vercel Pro**: Production hosting with serverless functions
- **Database**: Separate Neon PostgreSQL instance (not Replit dev database)
- **File Storage**: Supabase Storage for user avatar uploads

### Environment Variables
Complete documentation in `PRODUCTION_SETUP.md` covering:
- **CRITICAL** (3): DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- **REQUIRED** (3): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY
- **IMPORTANT** (1): OPENAI_API_KEY
- **OPTIONAL** (20+): Health integrations (Oura, Fitbit, Garmin, Whoop), email (Resend), error tracking (Sentry), site config
- **FEATURE FLAGS** (5): HOBH_FORCE_PREMIUM, AXLE_DISABLE_SIMPLE, AXLE_DISABLE_MOCK, etc.

### Health Check Endpoint
- **Route**: `GET /api/healthz`
- **Purpose**: Validates all environment variables without exposing values
- **Status Levels**:
  - `healthy` 🟢 - All critical/required/important variables configured
  - `degraded` 🟡 - Some variables missing, reduced functionality
  - `critical` 🔴 - Critical variables missing, app may crash
- **Response**: Categorized variable status (critical, required, important, optional, featureFlags) with actionable warnings

### Frontend Error Logging
- Enhanced `useAppStore.ts` with detailed error diagnostics
- Logs include status codes, response text, and helpful hints
- 500 errors → database connection issues
- 404 errors → profile setup needed
- 401 errors → authentication required

### Setup Process
1. Create Neon database with connection pooling enabled
2. Set all environment variables in Vercel
3. Run database migrations: `npm run db:push`
4. Deploy to Vercel
5. Visit `/api/healthz` to verify configuration
6. Monitor browser console for detailed error logs if issues occur