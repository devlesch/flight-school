# Implementation Plan: Supabase Backend Integration

**Track ID:** supabase-backend_20260131
**Spec:** [spec.md](./spec.md)
**Design:** [design.md](./design.md)

---

## Phase 1: Project Setup

### Epic 1.1: Install Dependencies and Configure Environment

- [x] Task 1.1.1: Install Supabase client
  - Run `npm install @supabase/supabase-js`
  - Verify package.json updated

- [x] Task 1.1.2: Create environment configuration
  - Create `.env.local` with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY placeholders
  - Add `.env.local` to `.gitignore` if not present
  - Create `.env.example` with placeholder values for documentation

- [x] Task 1.1.3: Create Supabase client
  - Create `lib/supabase.ts`
  - Initialize client with env vars
  - Export typed client instance

- [x] Task 1.1.4: Generate TypeScript types
  - Create `types/database.ts` with table interfaces
  - Match schema from design.md

- [~] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

---

## Phase 2: Database Schema

### Epic 2.1: Create Core Tables

- [x] Task 2.1.1: Create profiles table
  - Write SQL migration for profiles table
  - Include all fields from design.md
  - Add foreign key to auth.users

- [x] Task 2.1.2: Create training_modules table
  - Write SQL for training module definitions
  - Include type constraint for module types

- [x] Task 2.1.3: Create user_modules junction table
  - Write SQL for user progress tracking
  - Add unique constraint on (user_id, module_id)

### Epic 2.2: Create OKR Tables

- [x] Task 2.2.1: Create okrs and key_results tables
  - Write SQL for OKR structure
  - Add foreign key relationships

- [x] Task 2.2.2: Create user_okrs junction table
  - Write SQL for user-OKR assignments

### Epic 2.3: Create Manager Task Tables

- [x] Task 2.3.1: Create manager_task_templates table
  - Write SQL for task template definitions
  - Include due_date_offset field

- [x] Task 2.3.2: Create user_manager_tasks table
  - Write SQL for task completion tracking
  - Add unique constraint on (manager_id, new_hire_id, template_id)

### Epic 2.4: Create Social Tables

- [x] Task 2.4.1: Create shoutouts table
  - Write SQL with from_user_id and to_user_id references

- [x] Task 2.4.2: Create workbook_responses table
  - Write SQL with unique constraint on (user_id, prompt_key)

- [x] Task 2.4.3: Create module_comments table
  - Write SQL for module comments

### Epic 2.5: Create RLS Policies

- [x] Task 2.5.1: Create helper function get_user_role()
  - Write SQL function for role lookup

- [x] Task 2.5.2: Create profiles RLS policies
  - Admin: SELECT all
  - Manager: SELECT self + team
  - User: SELECT/UPDATE own

- [x] Task 2.5.3: Create user_modules RLS policies
  - Admin: SELECT all
  - Manager: SELECT team progress
  - User: ALL on own records

- [x] Task 2.5.4: Create public read policies
  - training_modules: SELECT for all authenticated
  - okrs, key_results: SELECT for all authenticated
  - manager_task_templates: SELECT for all authenticated

- [x] Task 2.5.5: Create remaining RLS policies
  - user_okrs, user_manager_tasks, shoutouts, workbook_responses, module_comments

- [~] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

---

## Phase 3: Authentication

### Epic 3.1: Implement Google OAuth

- [x] Task 3.1.1: Create auth service
  - Create `services/authService.ts`
  - Implement signInWithGoogle() using Supabase OAuth
  - Implement signOut()
  - Implement getSession()

- [x] Task 3.1.2: Create useAuth hook
  - Create `hooks/useAuth.ts`
  - Subscribe to auth state changes
  - Expose user, session, loading, signIn, signOut

- [x] Task 3.1.3: Create auto-profile creation trigger
  - Write SQL trigger/function for new user signup
  - Auto-create profile with default "New Hire" role
  - Extract name/avatar from Google metadata

### Epic 3.2: Update Login Component

- [x] Task 3.2.1: Replace Login component
  - Remove demo login buttons
  - Add "Sign in with Google" button
  - Handle OAuth redirect flow
  - Show loading state during auth

- [x] Task 3.2.2: Update App.tsx auth flow
  - Use useAuth hook for session state
  - Redirect to login if not authenticated
  - Show appropriate dashboard based on profile role

- [~] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

---

## Phase 4: Data Layer

### Epic 4.1: Profile Services

- [x] Task 4.1.1: Create profile service
  - Create `services/profileService.ts`
  - Implement getProfile(userId)
  - Implement updateProfile(userId, data)
  - Implement getCurrentProfile()

- [x] Task 4.1.2: Create useProfile hook
  - Create `hooks/useProfile.ts`
  - Fetch and cache current user profile
  - Provide loading/error states

### Epic 4.2: Module Services

- [x] Task 4.2.1: Create module service
  - Create `services/moduleService.ts`
  - Implement getModules() - all module definitions
  - Implement getUserModules(userId) - user progress
  - Implement updateModuleProgress(userId, moduleId, data)

- [x] Task 4.2.2: Create useModules hook
  - Create `hooks/useModules.ts`
  - Combine module definitions with user progress
  - Provide markComplete, updateScore functions

### Epic 4.3: Team Services (Manager)

- [x] Task 4.3.1: Create team service
  - Create `services/teamService.ts`
  - Implement getTeamMembers(managerId)
  - Implement getTeamProgress(managerId)

- [x] Task 4.3.2: Create useTeam hook
  - Create `hooks/useTeam.ts`
  - Fetch manager's direct reports
  - Include progress data for each team member

### Epic 4.4: Manager Task Services

- [x] Task 4.4.1: Create manager task service
  - Create `services/managerTaskService.ts`
  - Implement getTaskTemplates()
  - Implement getUserTasks(managerId, newHireId)
  - Implement updateTaskCompletion(taskId, completed)

- [x] Task 4.4.2: Create useManagerTasks hook
  - Create `hooks/useManagerTasks.ts`
  - Fetch and manage task completion state

- [~] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

---

## Phase 5: Component Integration

### Epic 5.1: Dashboard Integration

- [x] Task 5.1.1: Update AdminDashboard
  - Replace mock data with useProfile, useTeam hooks
  - Fetch all users for admin view
  - Handle loading/error states

- [x] Task 5.1.2: Update ManagerDashboard
  - Use useTeam hook for direct reports
  - Use useManagerTasks for onboarding tracker
  - Replace hardcoded NEW_HIRES with real data

- [x] Task 5.1.3: Update NewHireDashboard
  - Use useModules for training progress
  - Use useProfile for user data
  - Persist module completion to database

### Epic 5.2: Feature Integration

- [x] Task 5.2.1: Integrate OKRs
  - Create useOkrs hook
  - Fetch user's assigned OKRs
  - Display on NewHireDashboard

- [x] Task 5.2.2: Integrate workbook responses
  - Create useWorkbook hook
  - Save/load responses from database
  - Support manager comments

- [x] Task 5.2.3: Integrate shoutouts
  - Create useShoutouts hook
  - Fetch shoutouts for user
  - Display on dashboard

- [~] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

---

## Phase 6: Seed Data

### Epic 6.1: Create Seed Script

- [x] Task 6.1.1: Create seed SQL file
  - Create `supabase/seed.sql`
  - Convert MANAGERS from constants.ts to INSERT statements
  - Convert training modules to INSERT statements
  - Convert OKRs and key results

- [x] Task 6.1.2: Create manager task templates seed
  - Convert MANAGER_ONBOARDING_TASKS to INSERT statements

- [x] Task 6.1.3: Document seed execution
  - Add instructions for running seed in Supabase SQL editor
  - Note: Profiles created via auth signup, not seed

- [~] Task: Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)

---

## Phase 7: Cleanup and Polish

### Epic 7.1: Remove Mock Data Dependencies

- [ ] Task 7.1.1: Audit constants.ts usage
  - Find all imports of mock data
  - Verify each is replaced with Supabase data

- [ ] Task 7.1.2: Clean up constants.ts
  - Keep UNIVERSAL_SERVICE_STEPS (UI content, not data)
  - Remove MANAGERS, NEW_HIRES, MOCK_TRAINING_MODULES
  - Keep INDUSTRIOUS_LOGO_SVG and other UI constants

### Epic 7.2: Error Handling

- [ ] Task 7.2.1: Add global error boundary
  - Create ErrorBoundary component
  - Catch and display Supabase errors gracefully

- [ ] Task 7.2.2: Add connection status indicator
  - Show banner when Supabase is unreachable
  - Retry logic for failed requests

### Epic 7.3: Final Testing

- [ ] Task 7.3.1: Test authentication flow
  - Sign in with Google
  - Sign out
  - New user profile creation

- [ ] Task 7.3.2: Test role-based access
  - Verify Admin sees all data
  - Verify Manager sees only team
  - Verify New Hire sees only self

- [ ] Task 7.3.3: Test data persistence
  - Complete a module, refresh, verify persisted
  - Update profile, refresh, verify persisted

- [ ] Task: Conductor - User Manual Verification 'Phase 7' (Protocol in workflow.md)

---

## Summary

| Phase | Epic Count | Task Count |
|-------|------------|------------|
| Phase 1: Setup | 1 | 5 |
| Phase 2: Schema | 5 | 12 |
| Phase 3: Auth | 2 | 5 |
| Phase 4: Data Layer | 4 | 9 |
| Phase 5: Integration | 2 | 7 |
| Phase 6: Seed | 1 | 4 |
| Phase 7: Cleanup | 3 | 7 |
| **Total** | **18** | **49** |
