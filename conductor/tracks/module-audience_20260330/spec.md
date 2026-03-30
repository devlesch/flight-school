# Module Audience Targeting (Cohort vs Direct Reports)

## Overview
Add an audience field to training modules so admins can specify whether a module is for cohort students, direct reports, or all students. Modules are filtered at the service layer based on the student's relationship to their manager.

## Functional Requirements

### FR-1: Database Column
- Add `audience TEXT` column to `training_modules` table
- Values: `'cohort'`, `'direct'`, or `null` (all students)
- Nullable — existing modules default to null (backward compatible)

### FR-2: Task Builder Audience Field
- Add "Audience" dropdown in Targeting section of Task Builder
- Options: All Students (default) / Cohort Only / Direct Reports Only
- Pass to `createModule()` as `audience` field
- Also show in edit/update module flow

### FR-3: Manager View Module Filtering
- In `getCohortMembersForManager()`, filter modules per member based on source:
  - `source: 'cohort'` → show modules where `audience` is null or 'cohort'
  - `source: 'direct'` → show modules where `audience` is null or 'direct'
  - `source: 'both'` → show all modules

### FR-4: Student View Module Filtering
- Determine student's relationship type (cohort/direct/both)
- Filter modules in `getModulesWithProgress()` or at component level
- Student sees only modules matching their audience type

## Acceptance Criteria
- [ ] Task Builder shows Audience dropdown with 3 options
- [ ] Modules saved with correct audience value
- [ ] Cohort-only modules don't appear for direct-report-only students
- [ ] Direct-only modules don't appear for cohort-only students
- [ ] Students who are both see all modules
- [ ] Existing modules (audience=null) show to everyone
- [ ] Admin task list always shows all modules regardless of audience

## Out of Scope
- Per-student module assignment
- target_role filtering (separate track)
