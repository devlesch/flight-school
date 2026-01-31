# Tech Stack: Industrious Flight School

## Overview

Industrious Flight School is a modern single-page application (SPA) built with React and TypeScript, using Vite as the build tool for fast development and optimized production builds.

## Core Technologies

### Language
| Technology | Version | Purpose |
|------------|---------|---------|
| **TypeScript** | ~5.8.2 | Primary language for type-safe development |

### Frontend Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI component library and state management |
| **React DOM** | 18.2.0 | React renderer for web |

### Build & Development
| Technology | Version | Purpose |
|------------|---------|---------|
| **Vite** | ^6.2.0 | Build tool and dev server |
| **@vitejs/plugin-react** | ^5.0.0 | React support for Vite |

## UI & Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | (inline) | Utility-first CSS framework |
| **Lucide React** | ^0.561.0 | Icon library |
| **Recharts** | ^2.12.0 | Charting and data visualization |
| **Canvas Confetti** | 1.9.2 | Celebration animations |

## Backend & Authentication

| Technology | Version | Purpose |
|------------|---------|---------|
| **Supabase** | ^2.x | Backend-as-a-Service (PostgreSQL + Auth) |
| **@supabase/supabase-js** | ^2.x | Supabase JavaScript client |

### Database Tables
- `profiles` - User profiles (extends auth.users)
- `training_modules` - Training content definitions
- `user_modules` - User progress per module
- `okrs` - Objectives with key results
- `key_results` - Key results linked to OKRs
- `user_okrs` - User-OKR assignments
- `manager_task_templates` - Onboarding task templates
- `user_manager_tasks` - Task completion tracking
- `shoutouts` - User-to-user recognition
- `workbook_responses` - Workbook answers
- `module_comments` - Comments on modules

### Authentication
- Google OAuth via Supabase Auth
- Auto-profile creation on first login
- Domain restriction: `@industriousoffice.com` only

## AI Integration

| Technology | Version | Purpose |
|------------|---------|---------|
| **@google/genai** | ^1.33.0 | Google Gemini API for AI-powered features |

## Architecture

### Project Structure
```
/
├── App.tsx                 # Main application component with routing
├── index.tsx              # Entry point
├── index.html             # HTML template
├── types.ts               # TypeScript type definitions (legacy)
├── constants.ts           # Mock data fallback
├── components/
│   ├── AdminDashboard.tsx    # Admin role dashboard
│   ├── ManagerDashboard.tsx  # Manager role dashboard
│   ├── NewHireDashboard.tsx  # New hire role dashboard
│   ├── Login.tsx             # Google OAuth authentication
│   ├── ErrorBoundary.tsx     # Global error handling
│   └── ConnectionStatus.tsx  # Offline indicator
├── hooks/
│   ├── useAuth.ts            # Authentication state
│   ├── useProfile.ts         # User profile fetching
│   ├── useModules.ts         # Training module progress
│   ├── useTeam.ts            # Manager team data
│   ├── useManagerTasks.ts    # Onboarding tasks
│   ├── useOkrs.ts            # OKR fetching
│   ├── useWorkbook.ts        # Workbook responses
│   └── useShoutouts.ts       # Shoutouts
├── services/
│   ├── geminiService.ts      # Gemini AI integration
│   ├── authService.ts        # Supabase auth
│   ├── profileService.ts     # Profile CRUD
│   ├── moduleService.ts      # Training modules
│   ├── teamService.ts        # Team data
│   ├── managerTaskService.ts # Manager tasks
│   ├── okrService.ts         # OKRs
│   ├── workbookService.ts    # Workbook
│   └── shoutoutService.ts    # Shoutouts
├── lib/
│   └── supabase.ts           # Supabase client
├── types/
│   └── database.ts           # Database TypeScript types
├── supabase/
│   ├── migrations/           # SQL schema migrations
│   └── seed.sql              # Initial data seed
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Design Patterns
- **Component-based architecture** — UI broken into reusable React components
- **Role-based rendering** — Different dashboard views based on user role
- **Lifted state** — App-level state management for authentication and view switching
- **Type-safe development** — Full TypeScript coverage with defined interfaces

## Development

### Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest tests |
| `npm run test:coverage` | Run tests with coverage report |

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vitest** | ^3.2.4 | Test runner (native Vite integration) |
| **@vitest/coverage-v8** | ^3.2.4 | Coverage reporting |
| **@testing-library/react** | ^16.2.0 | React component testing utilities |
| **@testing-library/jest-dom** | ^6.6.3 | DOM matchers |
| **@testing-library/user-event** | ^14.6.1 | User interaction simulation |
| **jsdom** | ^26.0.0 | DOM environment for tests |

### Environment
- Requires `GEMINI_API_KEY` in `.env.local` for AI features
- Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for database
- Node.js required for development
- Supabase project with Google OAuth configured
