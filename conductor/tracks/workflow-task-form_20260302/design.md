---
track_id: workflow-task-form_20260302
created: 2026-03-02
status: approved
---

# Upload Task Form — Wire Up & Extend

## Problem Statement
We are solving **the inability to persist tasks to the database** for Operations Admins because the "Upload Training" form is a non-functional stub (`alert()` only) that never calls Supabase — and while fixing this, we add the missing `link` URL field, the `target_role` DB column, and a clear Module vs Call task category control.

## Success Criteria
- [ ] Tab renamed from "Upload Training" to "Upload Task"
- [ ] Form has a Task Category segmented control: **Module** | **Call**
- [ ] URL/link field added to form (optional for modules, prominent for calls)
- [ ] Submitting the form saves a record to `training_modules` in Supabase
- [ ] `target_role` column exists in the DB and is saved correctly (null = All Roles)
- [ ] `createModule()` function added to `moduleService.ts`
- [ ] `types/database.ts` updated with `target_role` field
- [ ] Tests cover the new service function and form submission flow

## Out of Scope
- Changing how `NewHireDashboard` queries/filters modules by role
- Editing or deleting existing modules from this form
- Drag-and-drop module ordering

## Chosen Approach
Option A — Minimal + Correct: add task category UI, expose link field, add `createModule()` service, write migration for `target_role`, wire form submit to Supabase. Keep `getModules()` unchanged.

## Design

### Architecture Overview
- 1 new migration: `005_training_module_target_role.sql`
- 1 new service function: `createModule()` in `moduleService.ts`
- UI changes in `AdminDashboard.tsx`: tab rename, segmented control, link field, wired submit
- `types/database.ts`: add `target_role` to `training_modules` Row/Insert/Update

### Components
- `AdminDashboard.tsx` line 379: tab label `'Upload Training'` → `'Upload Task'`
- Form heading: "Curriculum Module Builder" → "Task Builder"
- New segmented `[Module] [Call]` control at top of form (same pattern as Snapshot/History toggle, lines 665-677)
- When `taskCategory === 'call'`: auto-set `method = 'LIVE_CALL'`, hide Method dropdown, show link as prominent
- When `taskCategory === 'module'`: show Method dropdown with all non-call types, link optional
- `handleAddTraining`: replace `alert()` with `await createModule(...)`, show success/error inline

### Data Model

```sql
-- 005_training_module_target_role.sql
ALTER TABLE training_modules ADD COLUMN target_role TEXT DEFAULT NULL;
```

Updated `trainingData` state shape:
```ts
{
  taskCategory: 'module' | 'call',  // NEW — drives UI branching
  title: string,
  method: ModuleType,
  assignmentDay: number,
  targetRole: string,               // 'All Roles' maps to null in DB insert
  link: string,                     // NEW — maps to existing DB `link` column
  hasWorkbook: boolean,
  workbookContent: string,
  description: string,
}
```

`createModule()` signature:
```ts
export async function createModule(data: TrainingModule['Insert']): Promise<TrainingModule | null>
// Uses (supabase as any) cast per project pattern (AGENTS.md)
```

### User Flow
1. Admin opens "Workflow & Tasks" → "Upload Task" tab
2. Selects Task Category: **Module** or **Call**
3. Fills Title, Method (Module) or auto-LIVE_CALL (Call), Day Offset, Target Role, URL
4. Optionally enables Workbook Prompt toggle (Module only)
5. Clicks "Assign Resource" → saves to Supabase → success state → form resets after 1.5s

### Error Handling
- Supabase error: inline error message below submit button, form not reset
- Success: button flashes "✓ Task Assigned" (green), resets after 1.5s
- URL: soft validation (warn if not `https://`), not blocking

### Testing Strategy
- Unit test `createModule()` with mock Supabase client (success + error paths)
- Component test: "Upload Task" tab label renders; form submit calls `createModule` with correct payload; `target_role = null` when 'All Roles' selected; success/error states render
- Follow mock patterns in `tests/mocks/`

### Aesthetic Direction
- Tone: Consistent with existing dark-teal Admin dashboard
- Segmented control: `bg-white/10 p-1 rounded-xl` (matches Snapshot/History toggle)
- URL input: `bg-[#013E3F] border-b border-[#F3EEE7]/20` (matches existing inputs)
- Placeholder: `https://docs.google.com/presentation/...` or `https://app.lessonly.com/...`
- Success: `bg-green-600` button state before reset

## Grounding Notes
- `link` column confirmed in `training_modules` schema (`database.ts` line 79) — already exists, just not in the form
- `as any` cast pattern confirmed in `moduleService.ts` lines 86, 111
- Segmented control pattern confirmed in `AdminDashboard.tsx` lines 665-677
- `target_role` confirmed ABSENT from DB schema — migration required
- `workflowSubTab === 'training'` is the insertion point (line 602)
- Next migration number is `005_`

## Party Panel Insights
- Auto-set `method = 'LIVE_CALL'` programmatically when Call category selected (not just visually)
- Map `targetRole === 'All Roles'` → `null` in the DB insert payload
- Verify existing RLS on `training_modules` covers admin INSERT
- Reset `taskCategory` back to `'module'` on form reset

## Risks & Open Questions
- RLS on `training_modules`: check if existing policies allow admin INSERT (likely yes, but verify)
- `NewHireDashboard` currently ignores `target_role` — role filtering is a future concern, not in scope here
