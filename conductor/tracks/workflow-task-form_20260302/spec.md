# Spec: Upload Task Form — Wire Up & Extend

**Track ID:** workflow-task-form_20260302
**Type:** Feature
**Status:** New
**Created:** 2026-03-02

---

## Overview

The "Upload Training" form in the Admin Dashboard's Workflow & Tasks section currently collects input but never persists data — `handleAddTraining` simply fires `alert()`. This track wires up the form to Supabase, adds the missing `link`/URL field (already in the DB schema but absent from the UI), adds a DB column for `target_role` (present in form state but not in the database), and introduces a clear Module vs Call task category segmented control.

---

## Functional Requirements

### FR-1: Tab & Heading Rename
- The "Upload Training" tab label must be renamed to **"Upload Task"**
- The form heading "Curriculum Module Builder" must be renamed to **"Task Builder"**

### FR-2: Task Category Control
- A segmented `[Module] [Call]` control must appear at the top of the form
- Default selection: **Module**
- When **Call** is selected:
  - `method` is programmatically set to `LIVE_CALL`
  - Method dropdown is hidden
  - URL/link field is displayed prominently
  - Workbook Prompt toggle is hidden
- When **Module** is selected:
  - Method dropdown shows all non-LIVE_CALL types
  - URL/link field is optional
  - Workbook Prompt toggle is available

### FR-3: URL/Link Field
- A text input for `link` must be added to the form
- Optional for Module tasks; present for Call tasks
- Placeholder: `https://docs.google.com/presentation/... or https://app.lessonly.com/...`
- Soft validation: non-blocking warning if value doesn't start with `https://`

### FR-4: Database Persistence
- Submitting the form must call `createModule()` in `moduleService.ts` which inserts to `training_modules` via Supabase
- The `alert()` stub must be removed
- `targetRole === 'All Roles'` maps to `null` in the DB insert
- On success: button shows "✓ Task Assigned" (green) for 1.5s, then form resets
- On error: inline error message below the submit button; form is not reset

### FR-5: Database Migration
- Migration `005_training_module_target_role.sql` adds `target_role TEXT DEFAULT NULL` to `training_modules`
- Migration also adds admin INSERT/UPDATE/DELETE RLS policy on `training_modules` (currently only SELECT exists)

### FR-6: Service Layer
- `moduleService.ts` gains a `createModule(data: TrainingModule['Insert']): Promise<TrainingModule | null>` function
- Must use the existing `(supabase as any)` cast pattern (per AGENTS.md)

### FR-7: TypeScript Types
- `types/database.ts` adds `target_role: string | null` to `training_modules` Row, Insert, and Update interfaces

---

## Non-Functional Requirements

- All new code follows existing conventions: Tailwind inline styles, Lucide icons, service + hook pattern
- Test coverage: unit tests for `createModule()`, component tests for form submission and UI states
- Minimum 80% coverage maintained (per `conductor/workflow.md`)
- No changes to `getModules()` or how `NewHireDashboard` consumes modules

---

## Acceptance Criteria

- [ ] Tab label reads "Upload Task"
- [ ] Form heading reads "Task Builder"
- [ ] Segmented Module/Call control renders and switches form fields correctly
- [ ] URL/link input is present and saves to DB on submission
- [ ] Submitting the form creates a record in `training_modules` (verifiable in Supabase)
- [ ] `target_role` column exists in DB; stores `null` when "All Roles" is selected
- [ ] Admin INSERT/UPDATE/DELETE RLS policy exists on `training_modules`
- [ ] `createModule()` exists in `moduleService.ts` and is unit tested
- [ ] `types/database.ts` includes `target_role` in all `training_modules` interface variants
- [ ] Success state (green button flash + form reset) works correctly
- [ ] Error state (inline message, no reset) works correctly
- [ ] `npm test` passes with ≥80% coverage

---

## Out of Scope

- Changing how `NewHireDashboard` queries or filters modules by `target_role`
- Editing or deleting existing modules from this form
- Drag-and-drop module ordering

---

## Key Files

| File | Change |
|------|--------|
| `components/AdminDashboard.tsx` | UI changes — rename, segmented control, link field, wired submit |
| `services/moduleService.ts` | Add `createModule()` function |
| `types/database.ts` | Add `target_role` to `training_modules` types |
| `supabase/migrations/005_training_module_target_role.sql` | New file — column + RLS policy |
| `tests/unit/moduleService.test.ts` | New/updated — unit tests for `createModule()` |
| `tests/integration/AdminDashboard.test.tsx` | Updated — form submission and UI state tests |
