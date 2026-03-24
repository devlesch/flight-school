# Spec: Admin Dashboard — Real Data & AI Analytics

## Overview

Replace mock data imports (`NEW_HIRES`, `MANAGERS`, `MOCK_TRAINING_MODULES`, `MANAGER_ONBOARDING_TASKS` from `constants.ts`) in the Admin Dashboard with real Supabase data. Wire the existing Gemini AI `analyzeProgress()` feature to operate on real student profiles so admins get actionable insights.

## Functional Requirements

### FR-1: Admin Dashboard Stats Hook
Create `useAdminDashboard()` hook that:
- Fetches all student profiles via existing `useAllUsers()`
- Batch-fetches module progress via `getUserModulesBatch(userIds)`
- Joins with `training_modules` for module metadata (title, type, day_offset)
- Computes `due_date` from `user_modules.due_date` or `cohort.starting_date + day_offset`
- Maps combined data to `NewHireProfile[]` via a mapper function
- Returns pre-computed stats: `{ activeCount, avgProgress, atRiskCount }`
- Exposes `loading`, `error`, and `refetch` states

### FR-2: Data Mapper
Create `mapToNewHireProfiles()` function that:
- Accepts `Profile[]` and `UserModule[]` (with joined training module data)
- Groups modules by `user_id`
- Computes per-student `progress` as average module completion %
- Maps database field names to `NewHireProfile` interface (e.g., `manager_id` → `managerId`, `start_date` → `startDate`)
- Sets `managerTasks` to `[]` (not needed for KPI calculations)
- Handles edge cases: no modules assigned (progress = 0%), null fields

### FR-3: KPI Integration
Modify `AdminDashboard.tsx` to:
- Replace `NEW_HIRES.length` with `stats.activeCount`
- Replace mock average progress calculation with `stats.avgProgress`
- Replace mock `behindCount` with `stats.atRiskCount` (uses existing `isHireBehind()` logic on mapped data)
- Show loading skeleton while data fetches
- Show error state if Supabase queries fail

### FR-4: AI Analytics Integration
Modify the "Execute Analysis" feature to:
- Pass real `students: NewHireProfile[]` from hook to `analyzeProgress()`
- Disable button when no students exist ("No students to analyze")
- Keep existing Gemini error/disabled handling unchanged

### FR-5: Mock Data Cleanup
- Remove `NEW_HIRES`, `MANAGERS`, `MOCK_TRAINING_MODULES`, `MANAGER_ONBOARDING_TASKS` imports from AdminDashboard.tsx
- Supersede the existing standalone `useAllUsers()` call (line 61) with the new `useAdminDashboard()` hook

## Non-Functional Requirements

- **Performance:** Dashboard loads within 2s for up to 50 students
- **Test Coverage:** 80% minimum for all new code
- **Error Resilience:** Graceful degradation on Supabase/Gemini failures
- **Type Safety:** Full TypeScript coverage, no `any` types

## Acceptance Criteria

- [ ] AC-1: Pipeline Health KPI "Active Hires" reflects real student count from `profiles` table
- [ ] AC-2: Pipeline Health KPI "Avg Progress" shows real average across all students' module completion
- [ ] AC-3: Pipeline Health KPI "At Risk (Overdue)" counts students with `progress < 25%` or any overdue module (real `due_date`)
- [ ] AC-4: "Execute Analysis" button sends real student data to Gemini and displays meaningful analysis
- [ ] AC-5: No imports from `constants.ts` remain in `AdminDashboard.tsx` for `NEW_HIRES` or `MANAGERS`
- [ ] AC-6: Loading states shown during data fetch; error banner on failure
- [ ] AC-7: Empty state handled — 0 students shows zero KPIs and disabled AI button
- [ ] AC-8: All new hooks/services have unit tests; AdminDashboard has integration test updates
- [ ] AC-9: Existing tests continue to pass

## Out of Scope

- Server-side aggregate views/RPCs
- KPI card redesign or new KPIs
- ManagerDashboard or NewHireDashboard changes
- AI result caching
- Manager tasks enrichment for AI analysis (v2 enhancement)
