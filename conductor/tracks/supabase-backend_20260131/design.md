# Design: Supabase Backend Integration

**Track ID:** supabase-backend_20260131
**Created:** 2026-01-31
**Status:** Design Complete

---

## Problem Statement

The Flight School app currently relies on hardcoded mock data in `constants.ts`, making it impossible to:
- Persist user progress across sessions
- Support multiple real users simultaneously
- Scale beyond demo mode
- Implement real authentication

## Solution Overview

Integrate Supabase as the backend platform providing:
- **Authentication** — Google OAuth only (no email/password)
- **Database** — PostgreSQL with full data persistence
- **Row Level Security** — Role-based access control at database level

## User Stories

### US1: Google Sign-In
> As a user, I want to sign in with my Google account so I don't need to remember another password.

### US2: Persistent Progress
> As a new hire, I want my training progress saved so I can continue where I left off.

### US3: Manager Team View
> As a manager, I want to see only my direct reports' progress, not other teams.

### US4: Admin Oversight
> As an admin, I want to view all users and cohorts across the organization.

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
├─────────────────────────────────────────────────────────┤
│  Components     │  Hooks          │  Services           │
│  - App.tsx      │  - useAuth      │  - authService      │
│  - Dashboards   │  - useProfile   │  - profileService   │
│  - Login        │  - useModules   │  - moduleService    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      SUPABASE                            │
├─────────────────────────────────────────────────────────┤
│  Auth                      │  Database (PostgreSQL)     │
│  - Google OAuth provider   │  - profiles                │
│  - JWT sessions            │  - training_modules        │
│  - Auto profile creation   │  - user_modules            │
│                            │  - okrs / key_results      │
│                            │  - manager_task_templates  │
│                            │  - user_manager_tasks      │
│                            │  - shoutouts               │
│                            │  - workbook_responses      │
├─────────────────────────────────────────────────────────┤
│  Row Level Security (RLS)                               │
│  - Admin: Full access                                   │
│  - Manager: Team access                                 │
│  - New Hire: Self access only                          │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

#### Core Tables

```sql
-- Extends Supabase auth.users with app-specific data
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Manager', 'New Hire')),
  avatar TEXT,
  title TEXT,
  region TEXT,
  manager_id UUID REFERENCES profiles(id),
  department TEXT,
  start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training module definitions (content)
CREATE TABLE training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('WORKBOOK', 'VIDEO', 'LIVE_CALL', 'PERFORM', 'SHADOW', 'MANAGER_LED', 'BAU', 'LESSONLY', 'PEER_PARTNER')),
  duration TEXT,
  link TEXT,
  host TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User progress on modules (junction)
CREATE TABLE user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  liked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);
```

#### OKR Tables

```sql
CREATE TABLE okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  role_type TEXT, -- 'MXM', 'GM', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  target TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE user_okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  UNIQUE(user_id, okr_id)
);
```

#### Manager Task Tables

```sql
CREATE TABLE manager_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date_offset INTEGER NOT NULL, -- Days relative to start date
  time_estimate TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE user_manager_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  new_hire_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES manager_task_templates(id),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  UNIQUE(manager_id, new_hire_id, template_id)
);
```

#### Social Features Tables

```sql
CREATE TABLE shoutouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workbook_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL,
  response TEXT,
  manager_comment TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prompt_key)
);

CREATE TABLE module_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_manager_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoutouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbook_responses ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() = 'Admin');

CREATE POLICY "Managers can view their team"
  ON profiles FOR SELECT
  USING (
    get_user_role() = 'Manager'
    AND (id = auth.uid() OR manager_id = auth.uid())
  );

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- User modules policies
CREATE POLICY "Admins can view all progress"
  ON user_modules FOR SELECT
  USING (get_user_role() = 'Admin');

CREATE POLICY "Managers can view team progress"
  ON user_modules FOR SELECT
  USING (
    get_user_role() = 'Manager'
    AND user_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())
  );

CREATE POLICY "Users can manage own modules"
  ON user_modules FOR ALL
  USING (user_id = auth.uid());

-- Training modules are public read
CREATE POLICY "Anyone can view training modules"
  ON training_modules FOR SELECT
  USING (true);

-- OKRs are public read
CREATE POLICY "Anyone can view OKRs"
  ON okrs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view key results"
  ON key_results FOR SELECT
  USING (true);

-- Manager task templates are public read
CREATE POLICY "Anyone can view task templates"
  ON manager_task_templates FOR SELECT
  USING (true);
```

### Authentication Flow

1. User clicks "Sign in with Google"
2. Supabase redirects to Google OAuth
3. Google authenticates and returns to app
4. Supabase creates session + JWT
5. App checks if profile exists:
   - If new user: Create profile with default "New Hire" role
   - If existing: Load profile data
6. App renders appropriate dashboard based on role

### File Structure

```
/
├── lib/
│   └── supabase.ts              # Supabase client initialization
├── hooks/
│   ├── useAuth.ts               # Auth state and session
│   ├── useProfile.ts            # Current user profile
│   ├── useModules.ts            # Training modules + progress
│   ├── useTeam.ts               # Manager's team data
│   └── useManagerTasks.ts       # Onboarding task tracking
├── services/
│   ├── authService.ts           # signInWithGoogle, signOut
│   ├── profileService.ts        # getProfile, updateProfile
│   ├── moduleService.ts         # getModules, updateProgress
│   ├── teamService.ts           # getTeamMembers, getTeamProgress
│   └── geminiService.ts         # (existing, unchanged)
├── types/
│   ├── database.ts              # Supabase generated types
│   └── index.ts                 # (existing types.ts, updated)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                 # Initial data from constants.ts
└── .env.local
    ├── VITE_SUPABASE_URL=your-project-url
    └── VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Migration Strategy

1. **Phase 1: Setup** — Install Supabase client, configure env vars
2. **Phase 2: Schema** — Run SQL migrations to create tables
3. **Phase 3: Auth** — Replace Login component with Google OAuth
4. **Phase 4: Data Layer** — Create hooks/services for data fetching
5. **Phase 5: Integration** — Update components to use real data
6. **Phase 6: Seed** — Migrate mock data as seed script
7. **Phase 7: Cleanup** — Remove constants.ts mock data references

---

## Acceptance Criteria

- [ ] Google OAuth login works end-to-end
- [ ] New users get profile auto-created on first login
- [ ] Role-based dashboard rendering works (Admin/Manager/New Hire)
- [ ] Training progress persists in database
- [ ] Manager can view only their team's progress
- [ ] Admin can view all users and progress
- [ ] App handles Supabase connection errors gracefully
- [ ] All existing UI functionality preserved

## Dependencies

**New packages:**
- `@supabase/supabase-js` — Supabase client library

**Supabase project requirements:**
- Google OAuth provider enabled
- Database with schema applied
- RLS policies configured

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Google OAuth domain restrictions | Configure allowed domains in Google Cloud Console |
| RLS policy gaps | Comprehensive testing of all role combinations |
| Data migration errors | Seed script with validation, rollback capability |
| Performance on large datasets | Add indexes on foreign keys, pagination |

## Out of Scope

- Email/password authentication
- Real-time subscriptions
- File storage for avatars
- Admin UI for content management
- Offline mode with local sync
