# Implementation Plan: module-audience_20260330

## Phase 1: Database + Types

- [ ] Task 1.1: Create `supabase/migrations/015_add_module_audience.sql`
  - [ ] ALTER TABLE training_modules ADD COLUMN audience TEXT
- [ ] Task 1.2: Update `types/database.ts` — add `audience` to training_modules Row/Insert/Update
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Task Builder UI

- [ ] Task 2.1: Add Audience dropdown to Task Builder in AdminDashboard
  - [ ] Add to Targeting section: All Students / Cohort Only / Direct Reports Only
  - [ ] Wire to createModule() call with audience field
- [ ] Task 2.2: Add Audience field to module edit flow (if exists)
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Manager View Filtering

- [ ] Task 3.1: Update `getCohortMembersForManager()` in cohortService
  - [ ] Filter allModules per member based on source + module.audience
  - [ ] cohort source → audience null or 'cohort'
  - [ ] direct source → audience null or 'direct'
  - [ ] both source → all modules
- [ ] Task 3.2: Verify progress calculation accounts for filtered modules
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Student View Filtering

- [ ] Task 4.1: Determine student's relationship type
  - [ ] Check if student has manager_id set (direct report)
  - [ ] Check if student is in a cohort (by start_date in cohort range)
  - [ ] Derive audience type: cohort / direct / both
- [ ] Task 4.2: Filter modules in NewHireDashboard based on audience type
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
