# AXLE - Fitness Tracking Application

## Overview

AXLE is a modern, mobile-first Progressive Web App (PWA) designed for comprehensive fitness tracking. Its core purpose is to enable users to log workouts, track personal records, visualize achievements, and analyze their fitness progress through detailed reports. The application offers a clean, intuitive interface with a comprehensive dashboard, optimized for mobile devices, supporting a holistic approach to fitness management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite for fast development and optimized builds.
- **Design**: Mobile-first, responsive design using Tailwind CSS.
- **UI Components**: shadcn/ui built on Radix UI primitives for accessibility and consistency.
- **State Management**:
    - Client-side: Zustand for app settings and active workouts, with local persistence for offline capabilities.
    - Server-side: TanStack Query for data fetching, caching, and synchronization.

### Backend Architecture
- **Server**: Express.js with a RESTful API, implemented in TypeScript for type safety.
- **Modularity**: Abstracted storage interface (`IStorage`) with an in-memory option for development.
- **API Validation**: Zod schemas for request validation.

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries and schema management.
- **Schema**: Includes tables for users (authentication), workouts (with JSON exercise data), personal records, and achievements.

### Styling and Theming
- **Framework**: Tailwind CSS for utility-first styling and a custom design system.
- **Theming**: CSS variables for dynamic light/dark mode support.
- **Design System**: Card-based UI with consistent spacing, typography, and a brand-optimized color palette.

### Development and Build Process
- **Structure**: Monorepo with shared types and schemas (`/shared`).
- **Build Tools**: Vite for client, esbuild for server.
- **Development Environment**: Integrated Vite dev server with Express.

## External Dependencies

### UI and Component Libraries
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.
- **class-variance-authority**: Variant-based component APIs.
- **cmdk**: Command palette.

### State Management and Data Fetching
- **TanStack Query**: Server state management.
- **Zustand**: Client-side state management.

### Database and ORM
- **Drizzle ORM**: Type-safe database toolkit.
- **Neon Database**: Serverless PostgreSQL.
- **Drizzle Kit**: Database migration and introspection.

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

### Authentication and Session Management
- **connect-pg-simple**: PostgreSQL session store.
- **express-session**: Session middleware.