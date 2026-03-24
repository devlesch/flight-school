# Spec: Wire Manager Dashboard with Real Supabase Data

## Overview

Replace all mock/hardcoded data in the Manager Dashboard with real Supabase queries following the cohort-based data model: manager → `cohort_leaders` → `cohorts` → `profiles` (by date range) → `user_modules` progress. Remove all `constants.ts` imports, fix date calculations, and add proper empty states.

## Functional Requirements

### FR-1: Cohort Member Resolution Service
- New `getCohortMembersForManager(managerId)` function in `cohortService.ts`
- Query chain: `cohort_leaders WHERE profile_id = managerId` → get cohort(s) → `profiles WHERE start_date BETWEEN hire_start_date AND hire_end_date AND role = 'New Hire'`
- Enrich members with `user_modules` progress joined with `training_modules` for module details
- Compute due dates using `cohort.starting_date + training_module.day_offset`
- Return `ManagerCohortData`: `{ cohort, members: CohortMember[], leaders }`
- If manager has multiple cohorts, use most recent by `hire_start_date`
- Profiles with `start_date = null` excluded from membership

### FR-2: useCohortTeam Hook
- New `hooks/useCohortTeam.ts` wrapping `getCohortMembersForManager`
- Returns `{ members, cohort, leaders, loading, error, refetch }`
- Handles loading, error, and empty states
- Replaces `useTeam` in Manager Dashboard

### FR-3: Manager Dashboard Data Wiring
- Replace `useTeam(user.id)` with `useCohortTeam(user.id)`
- Remove `import { NEW_HIRES, MANAGERS } from '../constants'`
- Remove `mockHires` fallback — use real members directly
- Show cohort name in dashboard header/subtitle
- `isTaskOverdue` uses `new Date()` instead of hardcoded `new Date(2026, 0, 5)`

### FR-4: Reassign Modal with Real Leaders
- Replace `MANAGERS.filter(...)` with `leaders` from `useCohortTeam` data
- Show real cohort leaders (name, title, region) from Supabase profiles
- Filter out current user from the list

### FR-5: Empty States
- No cohort assignment → "You're not assigned to a cohort yet" with appropriate UI
- No students in cohort → "No New Bees in this cohort yet"
- Data loading → loading spinner (consistent with existing patterns)
- Fetch error → error message with retry button

## Non-Functional Requirements

### NFR-1: Performance
- Cohort member resolution should complete in <500ms (2-3 sequential Supabase queries)
- Progress calculation done client-side from `user_modules` data
- No additional queries on re-render (hook caches results)

### NFR-2: Backward Compatibility
- `useTeam` hook remains available (not deleted) for any other consumers
- `constants.ts` remains in codebase (other components may use it) — only remove the import from ManagerDashboard

## Acceptance Criteria

- [ ] AC-1: Manager sees real students from their cohort (matched by date range)
- [ ] AC-2: Student progress bars reflect actual `user_modules` completion percentages
- [ ] AC-3: Module list per student shows real `training_modules` with computed due dates
- [ ] AC-4: Overdue indicators use real current date
- [ ] AC-5: Reassign modal shows real cohort leaders from Supabase
- [ ] AC-6: Cohort name visible in the dashboard UI
- [ ] AC-7: Empty state shown when manager has no cohort assignment
- [ ] AC-8: Empty state shown when cohort has no students
- [ ] AC-9: No `NEW_HIRES` or `MANAGERS` imports in ManagerDashboard.tsx
- [ ] AC-10: Existing Admin Dashboard cohort logic unchanged

## Out of Scope

- Database schema changes
- Admin Dashboard modifications
- Workbook/OKR data wiring
- Real-time subscriptions
- Cohort switcher for multi-cohort managers (future track)
