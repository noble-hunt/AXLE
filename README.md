# AXLE - AI-Powered Fitness Tracking App 🏋️‍♂️

A modern, mobile-first Progressive Web App (PWA) for comprehensive fitness tracking with AI-powered workout generation. Built with React, TypeScript, and a focus on SwiftUI-inspired design.

## ✨ Features

- **🤖 AI Workout Generation** - Context-aware CrossFit-style workouts using OpenAI
- **📊 Personal Records Tracking** - Track PRs across multiple movement categories  
- **🏆 Achievement System** - Gamified progress tracking with unlock animations
- **📱 Mobile-First Design** - SwiftUI-inspired interface optimized for touch devices
- **🎯 Comprehensive Analytics** - Detailed reports on workout progress and performance
- **⚡ Real-Time State Management** - Zustand-powered reactive data flow
- **🌙 Dark Mode Support** - Seamless light/dark theme switching
- **♿ Accessible UI** - ARIA labels, keyboard navigation, proper contrast ratios

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or pnpm package manager

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Required for AI workout generation
OPENAI_API_KEY=your_openai_api_key_here

# Session management (auto-generated if not provided)
SESSION_SECRET=your_secure_session_secret

# Database (optional - uses in-memory storage by default)
DATABASE_URL=postgresql://user:password@localhost:5432/axle
```

### Installation & Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd axle
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:5000`

### Running on Replit

Set `PORT=8000` in Secrets. Run `npm run dev`. Preview opens on that port.

## 📱 Application Routes

| Route | Description | Features |
|-------|-------------|----------|
| `/` | Home Dashboard | Quick stats, recent workouts, weekly progress |
| `/workout` | Start Workout | Create new workouts or use templates |
| `/workout/:id` | Workout Details | View/complete workouts with feedback |
| `/workout-generate` | AI Generator | Generate personalized workouts with AI |
| `/history` | Workout History | Filter and browse completed workouts |
| `/prs` | Personal Records | Track PRs by movement category |
| `/achievements` | Achievement System | View unlocked achievements and progress |
| `/reports` | Analytics | Comprehensive fitness analytics dashboard |
| `/connect` | Wearables | Connect fitness trackers (placeholder) |

## 🤖 AI Configuration

### Switching Between Mock and Real AI

**For Development (Mock Data):**
- No OpenAI API key needed
- Uses pre-built workout templates
- All features work with sample data

**For Production (Real AI):**
1. Set `OPENAI_API_KEY` in environment
2. AI generates authentic CrossFit workouts with:
   - Proper exercise specifications
   - Correct weight standards (50/35# for dumbbell vs 95/65# for barbell)
   - Rx+/Rx scaling options
   - Creative workout names

### AI Workout Features

- **Context-Aware Generation** - Considers user's workout history and PRs
- **Authentic CrossFit Format** - Proper warm-up, metcon, and scaling options
- **Exercise Precision** - Distinguishes between "Double Dumbbell Thrusters" and "Barbell Thrusters"
- **Progressive Difficulty** - Adapts based on user's intensity preferences

## 🛠️ Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Database (if using PostgreSQL)
npm run db:generate  # Generate database migrations
npm run db:push      # Apply database changes
npm run db:studio    # Open database management UI

# Code Quality
npm run type-check   # TypeScript type checking
npm run lint         # ESLint code linting
```

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18** - Component-based UI with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling with custom design system
- **shadcn/ui** - Accessible component library built on Radix UI
- **Wouter** - Lightweight client-side routing
- **TanStack Query** - Server state management and caching
- **Zustand** - Client-side state management

### Backend Stack
- **Express.js** - RESTful API server
- **TypeScript** - Full-stack type safety
- **Drizzle ORM** - Type-safe database operations
- **OpenAI API** - AI-powered workout generation
- **Session Management** - Secure user session handling

### Database Schema
- **Users** - User profiles and preferences
- **Workouts** - Exercise data with JSON fields for flexibility  
- **Personal Records** - Exercise-specific PRs with categories
- **Achievements** - Gamification system with progress tracking

## 📦 Project Structure

```
axle/
├── client/src/           # Frontend application
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # shadcn/ui components
│   │   └── common/      # Custom components
│   ├── pages/           # Route components
│   ├── store/           # Zustand state management
│   ├── lib/             # Utilities and configurations
│   └── types/           # TypeScript type definitions
├── server/              # Backend application
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Data persistence layer
│   └── workoutGenerator.ts # AI workout generation
├── shared/              # Shared types and schemas
│   └── schema.ts        # Database and validation schemas
└── attached_assets/     # Static assets and generated images
```

## 🎨 Design System

### Colors & Theming
- **Primary**: Lime green accent (#A3E635) for CTAs and highlights
- **Cards**: Subtle gradients with elevated shadows for depth
- **Typography**: Space Grotesk for clean, modern readability
- **Mobile-First**: Touch-friendly sizing with proper spacing

### UI Patterns
- **SwiftUI-Inspired**: Rounded corners, card-based layouts, smooth animations
- **Progressive Disclosure**: Loading states, empty states, error handling
- **Contextual Feedback**: Toast notifications, progress indicators, success states

## 🔮 Future Roadmap

### Phase 1: Enhanced Integrations
- **Wearable Device APIs** - Integrate with Vital or Junction for real fitness data
- **Real User Authentication** - Multi-provider auth with secure sessions
- **Cloud Database** - PostgreSQL deployment for production data persistence

### Phase 2: Advanced Features  
- **Social Features** - Workout sharing, leaderboards, community challenges
- **Advanced Analytics** - ML-powered insights, trend analysis, predictive metrics
- **Offline Support** - PWA caching, sync capabilities, offline workout logging

### Phase 3: Platform Expansion
- **Mobile Apps** - Native iOS/Android applications
- **Coach Dashboard** - Trainer tools, client management, program design
- **API Ecosystem** - Public APIs for third-party integrations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the existing code style and add tests
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋‍♂️ Support

For questions, bug reports, or feature requests:
- Create an issue in the repository
- Check existing documentation and README
- Review the code comments for implementation details

---

Built with ❤️ for fitness enthusiasts who love data-driven training.