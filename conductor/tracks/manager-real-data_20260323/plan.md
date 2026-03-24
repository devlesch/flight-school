# Plan: Wire Manager Dashboard with Real Supabase Data

## Phase 1: Cohort Service & Hook

### Epic 1.1: getCohortMembersForManager Service Function
- [x] Task 1.1.1: Write tests for getCohortMembersForManager
- [x] Task 1.1.2: Implement getCohortMembersForManager in cohortService.ts
  - [x] Add CohortMember, UserModuleWithDetails, ManagerCohortData interfaces
  - [x] Query cohort_leaders WHERE profile_id = managerId
  - [x] Get most recent cohort by hire_start_date
  - [x] Query profiles WHERE start_date BETWEEN hire_start_date AND hire_end_date AND role = 'New Hire'
  - [x] Query user_modules + training_modules for member progress
  - [x] Compute progress percentages and due dates
  - [x] Return complete ManagerCohortData

### Epic 1.2: useCohortTeam Hook
- [x] Task 1.2.1: Write tests for useCohortTeam hook
- [x] Task 1.2.2: Implement useCohortTeam hook
  - [x] Create hooks/useCohortTeam.ts
  - [x] Call getCohortMembersForManager(managerId)
  - [x] Manage loading, error, data states
  - [x] Expose refetch function

- [~] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Manager Dashboard Refactor

### Epic 2.1: Replace Team Data Source
- [x] Task 2.1.1: Write tests for ManagerDashboard with real data
- [x] Task 2.1.2: Wire useCohortTeam into ManagerDashboard
  - [x] Replace useTeam import with useCohortTeam
  - [x] Remove `import { NEW_HIRES, MANAGERS } from '../constants'`
  - [x] Remove mockHires fallback and useMemo transform
  - [x] Map CohortMember[] to NewHireProfile[] for existing UI components
  - [x] Add cohort name to dashboard header/subtitle
  - [x] Add empty state components for no-cohort and no-students

### Epic 2.2: Fix Date Calculations & Reassign Modal
- [x] Task 2.2.1: Write tests for date and reassign fixes
- [x] Task 2.2.2: Fix isTaskOverdue to use real dates
  - [x] Replace `new Date(2026, 0, 5)` with `new Date()`
  - [x] Use cohort.starting_date as baseline for task due date offsets
- [x] Task 2.2.3: Wire reassign modal with real leaders
  - [x] Replace `MANAGERS.filter(m => m.id !== user.id)` with leaders from useCohortTeam
  - [x] Map CohortLeader + Profile to the shape expected by the modal UI
  - [x] Handle empty leaders list

- [~] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Integration Testing & Cleanup

### Epic 3.1: Integration Tests
- [x] Task 3.1.1: Write integration tests for full Manager Dashboard flow

### Epic 3.2: Cleanup & Verification
- [x] Task 3.2.1: Audit and remove remaining mock references
  - [x] Grep ManagerDashboard.tsx for any remaining NEW_HIRES/MANAGERS/mock references
  - [x] Verify handleReassign uses real data (not NEW_HIRES.find)
  - [x] Verify calendar state uses real dates
- [x] Task 3.2.2: Verify test coverage meets 80% threshold
- [x] Task 3.2.3: Verify Admin Dashboard cohort logic unchanged

- [~] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
