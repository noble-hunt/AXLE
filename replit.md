# AXLE - Fitness Tracking Application

## Overview
AXLE is a mobile-first Progressive Web App (PWA) for comprehensive fitness tracking. It enables users to log workouts, track personal records, visualize achievements, and analyze fitness progress through an intuitive, mobile-optimized dashboard. The project aims to integrate a fine-tuned ML model for workout generation.

## Recent Changes (November 15, 2025)
- **Implemented Physics Container Visualization**: Replaced Gumball Machine with sophisticated physics-based container featuring: (1) Glass container with rx="12" rounded corners and gradient stroke, (2) Liquid fill meter that rises from bottom (max 85px) with blue gradient (url(#liquidGradient)), (3) Animated sine wave on liquid top edge (SVG path with A/B coefficients, 3s loop), (4) Gumball drop physics using spring easing 'spring(1, 80, 10, 0)' (1800ms) + bounce keyframes (600ms), (5) Triple ripple effect - 3 concentric circles expand from last gumball with anime.stagger(150), (6) Milestone celebrations at 10/25/50 workouts with container scale animation (1.05→1.0), confetti burst (20 particles, random velocities), and visible badge for 2s, (7) Complete reset cleanup with anime.remove() on all targets. Stable DOM structure with data-testid attributes (physics-workouts-counter, physics-svg-container, physics-gumball-group) ensures reliable programmatic access for testing. All animations verified working via e2e tests with visual + console evidence.
- **Replaced Training Identity Gem with Multi-Layered Crystal**: Completely redesigned the crystal visualization following anime.js homepage style with 3 nested SVG polygons (7 vertices each), 12 glowing vertex points that pulse based on streakDays (scale 1→1.5, intensity-driven), and 20 orbiting particles with staggered circular motion (36 keyframes, 8s orbit). Features: parallax rotation (20s/30s/25s), gradient morphing (red↔blue for strength/cardio ratios), and glassmorphism blur filter on middle layer. All animations coordinated with proper cleanup and responsiveness to slider changes.
- **Implemented Organic Blob - Vitality Orb Visualization**: Replaced previous blob with sophisticated organic morphing visualization featuring: (1) 5 SVG bezier paths that morph based on sleepQuality (compact→expanded, 2000ms easeInOutQuad), (2) Dynamic particle aura with count formula Math.floor(sleepQuality * 15) ranging 0-15 particles, (3) Circular orbital motion with 36 keyframes over 8000ms, particles pulse opacity [0.5,0.9,0.5] and radius [2,3,2], (4) Breathing animation scaling [1,1.08,1] with duration tied to restingHR (3000 - restingHR*10 ms, easeInOutSine loop), (5) HSL color cycling formula (sleepQuality * 0.5 + restingHR/200) * 360 for dynamic hue shifts, (6) Dynamic glow filter with stdDeviation = sleepQuality * 3 intensifying with better recovery, (7) Complete animation cleanup with anime.remove() preventing memory leaks, (8) Dynamic React-controlled 'd' attribute ensuring immediate visual feedback on state changes. All features architect-approved with stable data-testid hooks (blob-svg-container, blob-path, blob-particle-*) for testing.

## Recent Changes (November 15, 2025 - Tree Implementation Complete)
- **Added Polish Features to Health Viz Playground**: Implemented 6 polish features for enhanced UX: (1) FPS counter (requestAnimationFrame-based, top-right corner), (2) Debounced sliders (300ms delay, immediate UI feedback with dual-state pattern), (3) Random Workout Pattern button (adds 10 workouts over 3 seconds), (4) Reset Animations button (restarts tracked timelines), (5) Page Visibility API (pauses/resumes animations on tab switch), (6) **Auto-Play Demo** button (toggles every 2s slider randomization with proper cleanup). All features functional with proper test coverage. Known limitation: Reset and Page Visibility only affect 3 tracked timelines, not all ~20 looping animations; full coverage would require AnimationManager refactor.
- **Fixed Auto-Play Null Reference Crashes**: Resolved critical bug where rapid slider randomization during auto-play caused anime.js to receive null DOM targets during React re-renders. Implemented comprehensive defensive patterns: (1) Crystal gradient animation: early return on missing elements, try-catch around anime.remove(), **re-querying DOM elements** right before anime calls (freshGrad1/freshGrad2) to ensure fresh references, separate null checks per animation, outer try-catch wrapping all anime calls. (2) Blob morphing animation: double null check before path animation, separate null check before breathing animation, duration clamping to prevent negative values. E2E verified: auto-play runs 8+ seconds without Vite error overlay, all visualizations remain responsive, expected warnings in console are safe and non-blocking. Architect-approved with suggestions to lift gradient stops into React refs and consolidate animation lifecycle management for future improvements.
- **L-System Procedural Tree Visualization (PRODUCTION APPROVED)**: Fully implemented Growing Tree component using procedural L-System generation (rule: "F" → "F[+F]F[-F]F") with architect-designed algorithm. **Final implementation (4th iteration)**: (1) Explicit depth propagation - stack stores {x, y, angle, depth, parentLastIndex, branchTipIndex} ensuring siblings inherit parent depth correctly after nested brackets, (2) Separate branch tip tracking - parentLastIndex preserved during pop to prevent parent state corruption, branchTipIndex updated dynamically as 'F' encountered, (3) Complete terminal coverage - Set-based collection captures ALL branch tips (13 terminals with 2 iterations), (4) Hierarchy-based rendering - strokeWidth varies by depth (4=trunk, 3/2/1=branches), verified with 3 distinct stroke values. Features: Dynamic L-System with iterations=Math.min(Math.floor(streakWeeks/2), 3), staggered branch animation (strokeDashoffset 800ms+100ms stagger), mirrored root system (brown gradient, 0.3x scale), leaf placement limited by goodSleepNights (0-7), continuous wind sway, default streakWeeks=4 for visible initial tree. E2E verified: 25 branches, 3 distinct strokeWidths (4/3/2), 13 terminals, 4 leaves, anime.js loaded, zero errors. Stable data-testid="tree-container".

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