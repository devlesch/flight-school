# Plan: Upload Task Form — Wire Up & Extend

**Track ID:** workflow-task-form_20260302
**Spec:** [spec.md](./spec.md)
**Design:** [design.md](./design.md)

---

## Phase 1: Database & Types

> Lay the data foundation before touching any UI or service code.

- [x] **Task 1.1: Write migration `005_training_module_target_role.sql`** 426d81b
  - [x] Add `target_role TEXT DEFAULT NULL` column to `training_modules`
  - [x] Add `CREATE POLICY "Admins can manage training modules" ON training_modules FOR ALL USING (get_user_role() = 'Admin') WITH CHECK (get_user_role() = 'Admin');`
  - [x] File: `supabase/migrations/005_training_module_target_role.sql`

- [x] **Task 1.2: Update `types/database.ts`** 426d81b
  - [x] Add `target_role: string | null` to `training_modules` Row
  - [x] Add `target_role?: string | null` to `training_modules` Insert
  - [x] Add `target_role?: string | null` to `training_modules` Update

- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Database & Types'** (Protocol in workflow.md)

---

## Phase 2: Service Layer (TDD)

> Write tests first, then implement `createModule()`.

- [x] **Task 2.1: Write failing tests for `createModule()`** ea28f54
  - [x] Test: `createModule()` calls Supabase insert with correct payload and returns `TrainingModule` on success
  - [x] Test: `createModule()` returns `null` and logs error when Supabase returns an error
  - [x] Test: `createModule()` correctly passes `null` for `target_role` when input is `'All Roles'`
  - [x] File: `tests/unit/moduleService.test.ts`

- [x] **Task 2.2: Implement `createModule()` in `moduleService.ts`** ea28f54
  - [x] Add function signature: `export async function createModule(data: TrainingModule['Insert']): Promise<TrainingModule | null>`
  - [x] Use `(supabase as any)` cast for insert (per existing pattern)
  - [x] Chain `.select().single()` to return the created record
  - [x] Log error and return `null` on failure
  - [x] Run tests: 3/3 passing

- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Service Layer'** (Protocol in workflow.md)

---

## Phase 3: UI Changes (TDD)

> Write component tests first, then implement UI changes in `AdminDashboard.tsx`.

- [x] **Task 3.1: Write failing component tests** c53af8d
  - [x] Test: tab button with label "Upload Task" renders (not "Upload Training")
  - [x] Test: form heading "Task Builder" renders when training tab is active
  - [x] Test: Module/Call segmented control renders with "Module" active by default
  - [x] Test: selecting "Call" hides the Method dropdown
  - [x] Test: selecting "Call" shows the link input prominently
  - [x] Test: selecting "Call" hides the Workbook Prompt toggle
  - [x] Test: form submit calls `createModule` with correct payload including `link` and `type: 'LIVE_CALL'` when Call selected
  - [x] Test: `target_role` is `null` in payload when "All Roles" is selected
  - [x] Test: success state — button text changes to "✓ Task Assigned" after successful submit
  - [x] Test: error state — inline error message renders when `createModule` returns null
  - [x] File: `tests/unit/components/AdminDashboard.test.tsx` (extended)

- [x] **Task 3.2: Implement UI changes in `AdminDashboard.tsx`** c53af8d
  - [x] Rename tab label: `'Upload Training'` → `'Upload Task'`
  - [x] Rename form heading: `'Curriculum Module Builder'` → `'Task Builder'`
  - [x] Add `taskCategory` to state: `'module' | 'call'`, default `'module'`
  - [x] Add `link` to state: `string`, default `''`
  - [x] Add `submitting` state: `boolean`, default `false`
  - [x] Add `taskError` state: `string | null`, default `null`
  - [x] Add `taskSuccess` state: `boolean`, default `false`
  - [x] Add segmented `[Module] [Call]` control at top of form (`bg-white/10 p-1 rounded-xl`)
  - [x] On Call selected: sets `method: 'LIVE_CALL'`
  - [x] Conditionally hide Method dropdown when `taskCategory === 'call'`
  - [x] Conditionally hide Workbook Prompt toggle when `taskCategory === 'call'`
  - [x] Add URL/link input field in Structure section
  - [x] Replace `alert()` in `handleAddTraining` with async `createModule()` call
  - [x] Map `trainingData.targetRole === 'All Roles'` to `null` before insert
  - [x] Set `submitting = true` before call, `false` after
  - [x] On success: set `taskSuccess = true`, reset form after 1.5s
  - [x] On error: set `taskError = 'Failed to save task. Please try again.'`
  - [x] Render success state: submit button shows "✓ Task Assigned" with `bg-green-600`
  - [x] Render error state: red inline message below submit button
  - [x] Run tests: `npm test` — 61/61 passing

- [ ] **Task: Conductor - User Manual Verification 'Phase 3: UI Changes'** (Protocol in workflow.md)

---

## Summary

| Phase | Tasks | Files Changed |
|-------|-------|---------------|
| 1. Database & Types | 2 | `005_training_module_target_role.sql` (new), `types/database.ts` |
| 2. Service Layer | 2 | `services/moduleService.ts`, `tests/unit/moduleService.test.ts` |
| 3. UI Changes | 2 | `components/AdminDashboard.tsx`, `tests/integration/AdminDashboard.test.tsx` |
