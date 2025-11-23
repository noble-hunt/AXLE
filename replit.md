# AXLE - Fitness Tracking Application

## Recent Production Deployment Fixes (Nov 22, 2025)

### VERCEL SERVERLESS ROUTING FIX (Latest - Nov 23, 2025)
**Issue**: ALL API routes returning 404 "API endpoint / not found" in Vercel production
1. Profile API failing with 404
2. Save Workout feature broken
3. Direct navigation to /api/profiles shows `{"ok":false,"error":{"code":"NOT_FOUND","message":"API endpoint / not found"}}`
**Root Cause**: 
1. Vercel's rewrite from `/api/profiles` to `/api/[...slug]` does NOT populate `req.query.slug` for Node.js functions
2. Initial fix attempt using `req.query.slug` resulted in empty slug, reconstructing path as `/api/` instead of `/api/profiles`
3. Express received wrong path, all registered routes skipped, hitting catch-all 404 handler in server/app.ts:192-198
**Solution**: 
1. ✅ Read original path from Vercel's forwarded headers (`x-vercel-forwarded-path` or `x-forwarded-uri`)
2. ✅ Extract path and query string from forwarded headers
3. ✅ Restore `req.url`, `req.originalUrl`, and `req.path` before passing to Express
4. ✅ Added comprehensive logging to track serverless request routing
**Status**: Fixed in code, ready for Vercel deployment

### DAILY SUGGESTION START NOW FIX (Nov 23, 2025)
**Issue**: "Start Now" button failing to load workouts - generated workouts returned 404 errors
1. Frontend calling wrong API endpoint `/api/suggest/start` (non-existent)
2. Database mismatch: workouts created with Drizzle ORM but queried with Supabase Admin SDK
3. Result: workout created in dev database, GET request looked in production database → 404
**Root Cause**: 
1. `StartNowButton` component called `startSuggestion()` function which used old endpoint `/api/suggest/start`
2. Backend `createWorkoutFromSeed()` used Drizzle ORM to INSERT workouts → writes to development database
3. Backend `getWorkout()` used Supabase Admin SDK to SELECT workouts → reads from production database
4. Workouts were never found after creation due to database mismatch
**Solution**: 
1. ✅ Updated `startSuggestion()` in `client/src/features/workouts/suggest/api.ts` line 6 to call correct endpoint `/api/workouts/suggest/today/start`
2. ✅ Converted ALL workout DAL functions in `server/dal/workouts.ts` from Supabase Admin SDK to Drizzle ORM:
   - `getWorkout()`, `listWorkouts()`, `insertWorkout()`, `updateWorkout()`, `deleteWorkout()`
   - `startWorkoutAtomic()`, `getRecentRPE()`, `getZoneMinutes14d()`, `getStrain()`
   - `insertWorkoutFeedback()`, `getRecentRPEs()`, `getUserRecentWorkouts()`
3. ✅ Updated field mappings to use camelCase (Drizzle) instead of snake_case (Supabase)
4. ✅ Ensured workouts are now written AND read from the same development database
**Status**: Fixed and verified with e2e test - workouts load instantly after creation, no more 404 errors

### PROFILE UPSERT VALIDATION FIX (Nov 22, 2025)
**Issue**: Profile upsert endpoint failing with 500 errors, causing:
1. Profile data not loading (username, name, avatar not displaying)
2. Save Workout button showing "need to be signed in" error despite being authenticated
3. All profile-related features broken due to null profile state
**Root Cause**: 
1. Backend validation at `/api/profiles` endpoint (line 766, 789) was attempting to parse entire request body including the `action` field
2. `upsertProfileSchema` and `updateProfileSchema` don't include `action` as a valid field
3. Zod validation threw errors, causing 500 responses
4. Frontend couldn't set profile in store, leaving it null
**Solution**: 
1. ✅ Extract `action` field from request body before schema validation in both 'upsert' and 'update' actions
2. ✅ Enhanced frontend `upsertProfile` to store complete profile data including `preferredUnit`, `favoriteMovements`, and location metadata
3. ✅ Profile upsert now returns 200 status, profile loads successfully
4. ✅ Save Workout button and all profile-dependent features now working
**Status**: Fixed and verified - production-grade implementation confirmed by architect review

### SAVE WORKOUT PROFILE DATA FIX (Nov 22, 2025)
**Issue**: After deploying Save Workout feature:
1. Save Workout button showing "need to be signed in" error despite being authenticated
2. Profile firstName, lastName, and avatarUrl not displaying in UI
**Root Cause**: 
1. `upsertProfileSchema` in server/routes.ts (line 686) missing `savedWorkouts` field - Zod validation stripped it out during profile hydration
2. `updateProfile` INSERT fallback in server/dal/profiles.ts (line 203-211) missing `savedWorkouts → saved_workouts` field mapping
**Solution**: 
1. ✅ Added `savedWorkouts: z.array(z.string()).optional()` to upsertProfileSchema
2. ✅ Added `if (k === 'savedWorkouts') return 'saved_workouts';` to INSERT field mapping
3. ✅ Profile data now loads correctly with all fields (firstName, lastName, avatarUrl, savedWorkouts)
4. ✅ Save Workout feature now working properly in development
**Status**: Fixed in development, ready for production deployment

### WORKOUT GENERATOR TIMEOUT FIX (Latest - Nov 22, 2025)
**Issue**: Workout generator failing in production with "FUNCTION_INVOCATION_TIMEOUT" errors
**Root Cause**: 
1. Missing OPENAI_API_KEY secret in production environment
2. Vercel serverless function timeout set to 30s, but OpenAI calls can take 40-50s
3. OpenAI client configured with 60s timeout and 2 retries, exceeding Vercel's limits
**Solution**: 
1. ✅ Added OPENAI_API_KEY secret to Replit environment
2. ✅ Increased Vercel function maxDuration from 30s to 60s in vercel.json
3. ✅ Reduced OpenAI client timeout to 50s with maxRetries: 1 in both premium.ts and workoutGenerator.ts
4. ⏳ PENDING: Push to production and test workout generation
**Status**: Code fixed, ready for deployment testing

### CRITICAL VERCEL ROUTING FIX (Nov 22, 2025)
**Issue**: ALL API endpoints returning 404 on production - complete application failure
**Root Cause**: `"outputDirectory": "dist"` in vercel.json made Vercel treat deployment as static-only, preventing serverless function from being deployed
**Solution**: 
1. ✅ Removed `"outputDirectory": "dist"` from vercel.json
2. ✅ Ran comprehensive database migration `COMPLETE_PRODUCTION_SYNC.sql` in Supabase
3. ✅ API endpoints now working in production
**Status**: Fixed and deployed

### Database Schema Sync (Nov 22, 2025)
**Issue**: Production database missing columns that code expects
**Root Cause**: Schema evolved in development but production database not migrated
**Solution**: 
1. ✅ Created and ran `COMPLETE_PRODUCTION_SYNC.sql` migration
2. ✅ Added missing columns: `profiles.providers`, `profiles.latitude/longitude`, AXLE Reports fields
3. ✅ Added missing columns: `prs.notes`, `prs.workout_id`, `prs.created_at`
4. ✅ Created missing tables: `axle_reports`, `posts`, `group_messages`, `group_event_rsvps`, `group_invites`, `referrals`
**Status**: Database fully synced with code schema

### Build Artifacts Fix
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
- **Supabase Storage**: User avatar uploads.# Production schema updated: Sat Nov 22 04:20:10 PM UTC 2025
