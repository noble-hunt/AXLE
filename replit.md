# AXLE - Fitness Tracking Application

## Overview

AXLE is a modern fitness tracking web application built as a Progressive Web App (PWA) with a mobile-first design approach. The application allows users to log workouts, track personal records, view achievements, and analyze their fitness progress through detailed reports. It features a clean, intuitive interface optimized for mobile devices with a comprehensive dashboard for managing fitness activities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

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