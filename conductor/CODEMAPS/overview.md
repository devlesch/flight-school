# Industrious Flight School - Architecture Overview

## Project Summary

A React-based onboarding application for Industrious office staff. Provides role-based dashboards for New Hires, Managers, and Admins to track training progress, manage teams, and monitor onboarding tasks.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth)
- **Styling:** Tailwind CSS
- **Testing:** Vitest + Testing Library
- **AI:** Google Gemini API

## Directory Structure

```
/
├── App.tsx                    # Root component, routing, auth state
├── components/                # React UI components
│   ├── AdminDashboard.tsx     # Admin portal (cohorts, workflow, comms)
│   ├── ManagerDashboard.tsx   # Manager view (team, tracker)
│   ├── NewHireDashboard.tsx   # New hire journey (modules, calendar, workbook)
│   ├── Login.tsx              # Google OAuth login
│   ├── ErrorBoundary.tsx      # Global error handling
│   └── ConnectionStatus.tsx   # Offline indicator
├── hooks/                     # React hooks for data fetching
│   ├── useAuth.ts             # Authentication state
│   ├── useProfile.ts          # Current user profile
│   ├── useModules.ts          # Training modules + progress
│   ├── useTeam.ts             # Manager's team members
│   ├── useManagerTasks.ts     # Onboarding task completion
│   ├── useOkrs.ts             # Objectives & Key Results
│   ├── useWorkbook.ts         # Workbook responses
│   └── useShoutouts.ts        # User recognition
├── services/                  # Supabase API layer
│   ├── authService.ts         # OAuth operations
│   ├── profileService.ts      # Profile CRUD
│   ├── moduleService.ts       # Training module operations
│   ├── teamService.ts         # Team data queries
│   ├── managerTaskService.ts  # Task operations
│   ├── okrService.ts          # OKR queries
│   ├── workbookService.ts     # Workbook CRUD
│   ├── shoutoutService.ts     # Shoutout CRUD
│   └── geminiService.ts       # AI email drafts
├── lib/
│   └── supabase.ts            # Supabase client init
├── types/
│   └── database.ts            # Database TypeScript types
├── types.ts                   # Legacy app types
├── constants.ts               # Mock data (fallback)
├── supabase/
│   ├── migrations/            # SQL schema files
│   └── seed.sql               # Initial data
└── tests/                     # Vitest test suites
```

## Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React     │────▶│    Hooks     │────▶│  Services   │
│ Components  │◀────│  (useXxx)    │◀────│ (xxxService)│
└─────────────┘     └──────────────┘     └──────────────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │  Supabase   │
                                         │ (lib/supa.) │
                                         └─────────────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │ PostgreSQL  │
                                         │  + Auth     │
                                         └─────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Auth state, role-based routing, sidebar navigation |
| `lib/supabase.ts` | Supabase client singleton |
| `types/database.ts` | TypeScript types for all 11 tables |
| `services/*Service.ts` | CRUD operations per entity |
| `hooks/use*.ts` | React state + loading/error handling |

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `training_modules` | Training content definitions |
| `user_modules` | User progress per module |
| `okrs` | Objectives |
| `key_results` | Key results linked to OKRs |
| `user_okrs` | User-OKR assignments |
| `manager_task_templates` | Onboarding task templates |
| `user_manager_tasks` | Task completion tracking |
| `shoutouts` | User recognition messages |
| `workbook_responses` | Workbook answers |
| `module_comments` | Comments on modules |

## Authentication

- Google OAuth via Supabase Auth
- Domain restricted to `@industriousoffice.com`
- Auto-profile creation trigger on first login
- Role-based access: Admin > Manager > New Hire

## Entry Points

- `npm run dev` → Development server
- `npm test` → Run test suite
- `npm run build` → Production build
