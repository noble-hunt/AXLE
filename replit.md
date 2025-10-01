# AXLE - Fitness Tracking Application

## Overview

AXLE is a modern fitness tracking web application built as a Progressive Web App (PWA) with a mobile-first design approach. The application allows users to log workouts, track personal records, view achievements, and analyze their fitness progress through detailed reports. It features a clean, intuitive interface optimized for mobile devices with a comprehensive dashboard for managing fitness activities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Premium→UI Conversion Fix (October 1, 2025)
- **Enhancement**: Fixed premium workout conversion to respect block structure and eliminate synthetic placeholders
- **Implementation**:
  - **Block-to-Set Mapping**: Each premium block (warm-up, strength, conditioning, cool-down) becomes ONE set in UI format, preserving pattern titles like "E3:00 x 5", "EMOM 12", "AMRAP 8", "For Time 21-15-9"
  - **Exercise Listing**: All exercises in a block are listed with bullet points in the notes field (e.g., "• BB Front Squat: 4 reps @ 80%")
  - **Duration Conversion**: Block time_min converted to seconds for set duration (e.g., 15 min → 900s)
  - **Code Deduplication**: Exported convertPremiumToGenerated() function reused in both workoutGenerator.ts and routes.ts
  - **Unit Tests**: Added comprehensive unit tests with mocked data to verify no synthetic placeholders, pattern title preservation, and exercise listing
- **Files Modified**: `server/workoutGenerator.ts`, `server/routes.ts`, `server/__tests__/premium-conversion.test.ts`
- **Testing Results**:
  - ✅ No synthetic placeholders like "Bird Dog x 270s"
  - ✅ Pattern titles preserved: "Warm-Up", "E3:00 x 5", "EMOM 12", "Cool-Down"
  - ✅ Durations correctly converted: 420s, 900s, 720s, 660s
  - ✅ Exercises listed with targets in notes
  - ✅ Code deduplicated with shared converter function

### Premium Workout Sanitizer Upgrade (October 1, 2025)
- **Enhancement**: Advanced sanitization system with rotation-based substitution and intensity upgrades
- **Implementation**:
  - **Rotation System**: Replaces banned BW movements (wall sit, mountain climber, star jump, high knees) using equipment-aware rotation: DB Box Step-Overs → KB Swings → Wall Balls → Burpees. Tracks used substitutions per block to prevent duplicates.
  - **Case-Insensitive Matching**: BANNED_EASY stores lowercase variants (wall sit/sits, mountain climber/climbers, star jump/jumps, high knee/knees) with .toLowerCase() comparisons
  - **Enforcement Loop**: Iterates until remainingBanned ≤ 1 per main block, always replaces banned items regardless of equipment/readiness
  - **Pattern-Safe Rest Tightening**: Only E4:00 → E3:00 (valid pattern), removed unsafe E3:00 → E2:30
  - **Safe Reps Increase**: Only increases pure rep targets (/^\d+\s*reps?$/i or /^\d+$/), skips cal/time/complex to avoid corruption
  - **Loaded Finisher**: When hardness floor enforced, uses TWO loaded movements (e.g., BB Thrusters + BB Clean & Jerk) to maintain equipment ratio
  - **Mixed Rule Compatibility**: Accounts for hardnessFinisherAdded flag to allow +1 block when hardness floor enforced
  - **Scoping Fix**: Hoisted equipment array to function scope for consistent access throughout sanitizer
- **Files Modified**: `server/ai/generators/premium.ts`
- **Testing Results**:
  - ✅ All acceptance flags passing: hardness_ok, equipment_ok, mixed_rule_ok, patterns_locked
  - ✅ Hardness: 0.83-1.0 for equipped sessions (meets 0.75 floor)
  - ✅ Banned BW movements reduced to ≤1 per block with rotation substitution
  - ✅ Rest patterns remain valid (E3:00, E4:00 only)
  - ✅ Equipment ratio maintained with loaded finisher movements

### Hardness Scoring Improvements (October 1, 2025)
- **Enhancement**: Fixed hardness calculation to properly score intensity and enforce minimum thresholds
- **Implementation**:
  - **Pattern Matching Fix**: computeHardness now recognizes short forms (E3:00, E4:00) with case-insensitive regex
  - **Heavy-Movement Bonuses**: +0.05 each for BB Clean & Jerk, Thrusters, Deadlifts, Front Squats, Weighted Pull-Ups, Wall Balls, Farmer Carry
  - **Hardness Floor Enforcement**: Automatically appends ≤10 min 21-15-9 finisher when hardness < floor (0.75 for equipped sessions, 0.55 for low readiness)
  - **Equipment Validation Scope**: Tightened to strength + conditioning blocks only (skill/core excluded from loaded movement ratio)
- **Files Modified**: `server/ai/generators/premium.ts`
- **Testing Results**:
  - ✅ Hardness increased from 0.35 → 0.78 for CrossFit workouts with loaded movements
  - ✅ Pattern recognition: "E3:00 x 5" correctly adds +0.28
  - ✅ Heavy-movement bonuses: BB Clean & Jerk, DB Snatches each add +0.05
  - ✅ hardness_ok flag: true when floor is met

### Expanded Movement Pools + Fallback Ladder (October 1, 2025)
- **Enhancement**: Richer, harder movement choices with graceful degradation
- **Implementation**:
  - **Strength Pool Additions**: BB Thruster, BB Clean & Jerk, DB Bench Press, Weighted Pull-Ups (fallback: Strict → Ring Rows), Deadlift variations, Front Squat
  - **Conditioning Pool Additions**: Wall Balls, Farmer Carry (DB/KB), Shuttle Runs (no machine only), DB Snatches (alt: KB Swings)
  - **Fallback Ladder**: Barbell → Dumbbell → Kettlebell → Bodyweight
  - **Equipment Validation**: When gear (BB/DB/KB) is present, at least 2/3 of main movements must be loaded
  - **Acceptance Flag**: acceptance_flags.equipment_ok === true validates loaded movement ratio
- **Files Modified**: `server/ai/generators/premium.ts`
- **Testing Results**:
  - ✅ Equipment validation: 2/3 movements loaded when gear present
  - ✅ Heavier movements: BB Clean & Jerk, DB Snatches prioritized
  - ✅ equipment_ok flag correctly validates

### Mixed Semantics Enforcement (October 1, 2025)
- **Enhancement**: Strict enforcement of Mixed workout semantics - exactly one block per selected category
- **Implementation**:
  - **Category Mapping**: CrossFit/HIIT defaults to Strength + Conditioning (2 main blocks)
  - **Block Generation**: Generates exactly N main blocks where N = len(categories_for_mixed)
  - **Finisher Rule**: If total time < duration × 0.9, append one finisher block (For Time 21-15-9, ≤10 min)
  - **Validation**: acceptance_flags.mixed_rule_ok checks len(main_blocks) === len(categories) OR len(categories) + 1 (if finisher)
  - **Helper Function**: extractFocusAndCategories() maps request category to focus and categories_for_mixed
  - **Logging**: Detailed warnings for mixed rule violations with expected vs actual block counts
- **Files Modified**: `server/ai/generators/premium.ts`
- **Testing Results**: 
  - ✅ CrossFit with 45min generates exactly 2 blocks (Strength "Every 3:00 x 5" + Conditioning "AMRAP 12")
  - ✅ mixed_rule_ok flag correctly validates block count
  - ✅ Warmup (≥6min) and Cooldown (≥4min) preserved

### HOBH CF/HIIT Premium Generator Implementation (October 1, 2025)
- **Enhancement**: Upgraded workout generation system with strict CrossFit/HIIT format and quality enforcement
- **Implementation**:
  - Replaced basic prompt with HOBH CF/HIIT generator system message for all workout categories
  - Enforces strict structure: Warm-up (≥6min) → Main Block(s) → Cool-down (≥4min)
  - Main blocks limited to: E3:00 x 5 (strength density), EMOM 10-16, AMRAP 8-15, For-Time 21-15-9
  - Banned bodyweight filler (wall sit, mountain climber, star jump, high knees) in main blocks
  - **Hardness Score System**: Raised floor to 0.75 when barbell/dumbbell/kettlebell equipment present and sleep ≥ 60
    - Pattern-based: E3:00x5 = .28, EMOM = .22, AMRAP = .22, 21-15-9 = .20
    - Equipment bonuses: Barbell +.05, DB/KB +.03, Cyclical +.02
    - Penalties: -0.07 if 2+ bodyweight-only movements, -0.05 for bodyweight-only strength blocks
    - Bonus: +0.03 for cyclical + loaded movement pairings in EMOMs
  - **Post-Generation Sanitizer**: Automatically removes banned exercises and validates hardness
  - **Movement Pools**: Conditioning (Echo Bike, Row, Ski, KB Swings, DB Step-Overs, Burpees), Strength (BB/DB/KB variants), Skill (T2B, DU, HS), Core (Hollow Rocks, Planks, Sit-Ups)
- **Files Modified**: `server/ai/generators/premium.ts`, `server/workoutGenerator.ts`, `server/routes.ts`
- **Benefits**: Eliminates low-quality workouts, ensures proper warm-up/cool-down, equipment-aware substitutions, readiness-based modifications

### Production Data Display Fix (September 30, 2025)
- **Issue**: Production app was not displaying user profiles or workout history correctly
- **Root Cause**: 
  - Database stores fields in snake_case (`first_name`, `user_id`, `started_at`) but frontend expected camelCase
  - Production was running a stale build without the mapping fixes
- **Solution**: 
  - Added `mapProfileToFrontend()` helper in `server/dal/profiles.ts` to convert DB fields to camelCase
  - Added `mapWorkoutToFrontend()` helper in `server/dal/workouts.ts` for workout data conversion
  - Updated all workout DAL functions to use the mapping (listWorkouts, getWorkout, insertWorkout, updateWorkout, startWorkoutAtomic)
  - Frontend `upsertProfile()` in `client/src/store/useAppStore.ts` reads camelCase fields with snake_case fallbacks
  - Note: `getUserRecentWorkouts()` remains snake_case as it's only used internally by backend calculation modules
- **Files Modified**: `server/dal/profiles.ts`, `server/dal/workouts.ts`, `client/src/store/useAppStore.ts`
- **Deployment Status**: Changes ready for production deployment via Vercel

## System Architecture

### Frontend Architecture
- **React SPA**: Built with React 18 using TypeScript for type safety and better development experience
- **Vite Build System**: Fast development server and optimized production builds with hot module replacement
- **Mobile-First Design**: Responsive design with Tailwind CSS, optimized for mobile devices with touch-friendly interactions
- **Component Library**: shadcn/ui components built on Radix UI primitives for accessibility and consistent design
- **State Management**: 
  - Zustand for client-side state management (app settings, active workouts)
  - TanStack Query for server state management and caching
  - Local persistence using zustand/middleware for offline functionality

### Backend Architecture  
- **Express.js Server**: RESTful API server with middleware for request logging and error handling
- **TypeScript**: Full-stack TypeScript implementation for type safety across client and server
- **Modular Storage Interface**: Abstract storage layer (`IStorage`) with in-memory implementation for development
- **Route Organization**: Centralized route registration with validation using Zod schemas
- **Development Tooling**: Vite integration for development with HMR support

### Data Layer
- **Drizzle ORM**: Type-safe database queries and schema management
- **PostgreSQL Database**: Production database with support for JSON fields for complex workout data
- **Schema Design**: 
  - Users table for authentication
  - Workouts table with JSON exercise data and workout metadata
  - Personal records tracking with exercise-specific PRs
  - Achievements system for gamification

### Styling and Theming
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **CSS Variables**: Dynamic theming support for light/dark modes
- **Custom Design System**: 
  - Consistent spacing and typography using CSS custom properties
  - Card-based UI with custom shadows and border radius
  - Color palette optimized for fitness app branding

### Development and Build Process
- **Monorepo Structure**: Shared types and schemas between client and server (`/shared`)
- **Path Aliases**: Simplified imports using TypeScript path mapping
- **Build Pipeline**: 
  - Client builds to `/dist/public` for static serving
  - Server builds with esbuild for Node.js deployment
- **Development Server**: Integrated Vite dev server with Express for full-stack development

## External Dependencies

### UI and Component Libraries
- **Radix UI**: Comprehensive set of accessible, unstyled UI primitives for complex components (dialogs, dropdowns, navigation)
- **Lucide React**: Icon library providing consistent iconography throughout the application
- **class-variance-authority**: Utility for creating variant-based component APIs
- **cmdk**: Command palette component for enhanced user interaction

### State Management and Data Fetching
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **Zustand**: Lightweight state management for client-side application state

### Database and ORM
- **Drizzle ORM**: Type-safe database toolkit with automatic TypeScript inference
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Drizzle Kit**: Database migration and introspection tools

### Development and Build Tools
- **Vite**: Fast build tool and development server with plugin ecosystem
- **esbuild**: Fast JavaScript bundler for server-side builds
- **PostCSS**: CSS processing with Tailwind CSS integration
- **TypeScript**: Static type checking and enhanced developer experience

### Utility Libraries
- **date-fns**: Date manipulation and formatting utilities
- **clsx/tailwind-merge**: Conditional CSS class utilities
- **nanoid**: Unique ID generation for client-side entities
- **react-hook-form**: Form state management with validation
- **zod**: Schema validation for API endpoints and form data

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **express-session**: Session middleware for user authentication state

The application is designed to be easily deployable to cloud platforms with environment-based configuration and supports both development and production environments with appropriate tooling and optimizations.