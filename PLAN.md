# Plan — Manager "My Manager Path" Personal Onboarding Checklist

## Summary
A manager in flight-school is themselves a new hire being onboarded. Today the manager
view only shows their *team* and a per-hire tracker. We add a third area — **My Manager Path** —
a personal checklist of the manager's own onboarding tasks (the "manager tasks" authored
in the admin *Tasks-Manager* view), dated off the **manager's own hiring date**
(`profiles.start_date + due_date_offset`), presented with the new-hire path UX (progress
bar, Up Next / Overdue, click-to-complete, confetti). Displayed label: **"My Manager Path"**. The manager-view **calendar** is
also extended to surface these personal tasks alongside the existing team items.

**Data model:** a dedicated `manager_self_tasks` table, keyed `(manager_id, template_id)`.
Chosen over reusing `user_manager_tasks` with `new_hire_id NULL` because Postgres treats
NULLs as distinct (breaks dedup) and overloading `new_hire_id` would trip future
profile-merge migrations. A separate table keeps the per-hire path 100% untouched, gives a
clean two-column unique key, and trivial RLS. ~30-line migration + one service + one hook
+ one type.

## Locked decisions
- Managers are onboarded like new hires → keep `due_date_offset` (no change to manager-task
  authoring). Offsets anchor to the **manager's own `profiles.start_date`** — recent, since
  managers are freshly hired, so dates land sensibly (no "tenured-manager all-overdue" issue).
- Manager tasks are the manager's own list; the existing per-hire flow is left untouched.
- Shared task pool (no self-vs-hire scope flag in v1).
- **Calendar:** the manager-view "Week at a Glance" lists the manager's own tasks **plus**
  their hires' tasks. Hire coverage stays as today — **manager-led + live calls only**
  (option A) — and the manager's personal self-tasks are added on top.

---

## UX/UI rethink — manager-view layout
The manager view keeps **My Team** (hire grid + Week at a Glance) and **Onboarding Tracker**
(per-hire), and gains a third peer area: **My Manager Path**.

- **Placement:** a third `activeTab` value `'my-tasks'`, rendered as its own full-canvas
  section (mirrors the new-hire standalone "Your Path"). Surface it via an in-component
  segmented switcher — **My Team / My Manager Path / Onboarding Tracker** — replacing the
  currently-hidden switcher slot (~line 506). Deep-linkable via `?tab=my-tasks`.
- **Section anatomy** (lifted from `NewHireDashboard` "Your Path", dropping module-type machinery):
  - **Header:** `My Manager Path` + subtitle *"Your personal onboarding checklist as a manager."*
    Right-aligned clickable `{progress}%` toggling a "remaining only" filter.
  - **Progress bar:** `completedCount / tasks.length`, divide-by-zero guarded.
  - **Up Next / Overdue banners:** derived from `due_date`, using
    `new Date(due_date + 'T00:00:00')` to avoid the UTC off-by-one. "Start" calls `toggleComplete`.
  - **Task rows:** completed strikethrough, `CheckCircle`/`Circle` toggle, due date,
    description; optional `time_estimate` chip + optional `link` button. Sorted by due date.
  - **Confetti on complete:** `confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#FDD344','#013E3F'] })`.
  - **Empty state:** *"No manager onboarding tasks have been set up yet. Check back soon."*
    (hide bar/banners — no 0%/NaN).
  - **Loading:** inline `Loader2` spinner.
- Renders after the existing welcome-guide gate (`manager_welcome_dismissed`), same as the
  rest of the dashboard.

---

## Calendar — Week at a Glance (My Team tab)
The manager view has **one** calendar: the "Week at a Glance"
(`ManagerDashboard.tsx:733-771`), fed by `getWeeklyTasks()` (`:215-271`). It must become the
manager's single source of "what's due this week."

- **Keep (as today):** each hire's **manager-led training** + **live calls** — clicking a
  cell opens that hire's modal.
- **Add:** the manager's own **self-tasks** (by `due_date`) as a new category
  (e.g. `type: 'SELF'`), styled "My Tasks" in `#FDD344` — clicking a cell jumps to the
  **My Manager Path** tab.
- **Legend:** add a third chip next to "Manager Led Training" / "Admin Task" (`:724-731`)
  for "My Tasks", with a matching cell style.

---

## Data model & migration
`supabase/migrations/025_manager_self_tasks.sql` (HEAD is 024):

```sql
CREATE TABLE IF NOT EXISTS manager_self_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id  UUID NOT NULL REFERENCES manager_task_templates(id),
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_manager_self_task UNIQUE (manager_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_self_tasks_manager_id
  ON manager_self_tasks(manager_id);

ALTER TABLE manager_self_tasks ENABLE ROW LEVEL SECURITY;

-- Manager owns their own rows (faithful copy of the proven user_manager_tasks policy).
CREATE POLICY "Managers manage own self tasks"
  ON manager_self_tasks FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Admins manage all (FOR ALL covers SELECT — no separate admin SELECT policy needed).
CREATE POLICY "Admins manage all self tasks"
  ON manager_self_tasks FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- MERGE NOTE: future profile-merge migrations (cf. 004/006) must also
--   UPDATE manager_self_tasks SET manager_id = <surviving_id> WHERE manager_id = <merged_id>;
-- handling the UNIQUE(manager_id,template_id) collision (delete-then-update).
```

`types/database.ts`: add a `manager_self_tasks` Tables block (`{id, manager_id, template_id,
completed, completed_at, due_date, created_at}` — only `manager_id`/`template_id` required on
Insert) and `export type ManagerSelfTask = ...`.

---

## Instantiation — lazy reconcile on load
Triggered when a manager renders My Manager Path (mirrors the existing read-then-init precedent,
upgraded to self-heal):
1. `getTaskTemplates()` (non-deleted only — reuses existing service fn).
2. `SELECT * FROM manager_self_tasks WHERE manager_id = managerId`.
3. For each task **without** a row, build an insert row with
   `due_date = manager.start_date + due_date_offset` (same computation as
   `initializeTasksForNewHire`).
4. **Only if `missing.length > 0`**, `upsert(rows, { onConflict: 'manager_id,template_id',
   ignoreDuplicates: true })` — race-safe & idempotent; steady state stays read-only.
5. Re-read and inner-join against non-deleted templates (drop rows whose task was
   soft-deleted → no blank cards).

**Anchor:** the manager's own `profiles.start_date` (service fetches it; `User` has no
`start_date`). Edge cases: no start_date → fall back to today + suppress overdue styling;
no tasks → empty state; tasks added later → picked up next load; soft-deleted → filtered out.

---

## Service + hook changes
**New `services/managerSelfTaskService.ts`** (reuses `getTaskTemplates`; does not touch the
per-hire path):
- `getSelfTasks(managerId)` — select + inner-join to non-deleted templates.
- `reconcileSelfTasks(managerId)` → `{ tasks, anchorMissing }` — the flow above.
- `updateSelfTaskCompletion(taskId, completed)` — same body as `updateTaskCompletion`, on the new table.

**New `hooks/useManagerSelfTasks.ts`** — mirrors `useManagerTasks`:
`{ tasks, anchorMissing, loading, error, refetch, toggleComplete }`; reconcile on mount,
optimistic toggle.

**No changes** to `managerTaskService.ts` / `useManagerTasks.ts`.

---

## Component changes
**`components/ManagerDashboard.tsx`**
- Widen `initialTab` / `activeTab` unions to include `'my-tasks'` (~lines 16, 118-119).
- Add the missing sync effect: `useEffect(() => { if (initialTab) setActiveTabRaw(initialTab); }, [initialTab]);`
- Import + call `useManagerSelfTasks(user.id)` on a **new line** (don't reuse the dead line-39 destructure).
- Add `'my-tasks'` arm to the header title/subtitle ternaries (~498-503).
- Replace the hidden switcher comment (~506) with a 3-way segmented control.
- Insert the `{activeTab === 'my-tasks' && (…)}` render block before the tracker block.
- **Extend `getWeeklyTasks()`** to also push the manager's self-tasks (`type: 'SELF'`, by
  `due_date`); add the "My Tasks" legend chip + cell style + jump-to-My-Path click handler.
- **Add `Circle` to the lucide-react import (line 4)** — used by the toggle, currently
  missing → `tsc` would fail.

**`App.tsx`** — add `'my-tasks'` to the manager tab whitelist (~38) and widen the
`initialTab` cast (~229). No URL reader/writer change.

**`components/Sidebar.tsx`** — no change (discovery via the in-component switcher).

**`components/AdminDashboard.tsx`** — copy only: reword the *Tasks-Manager* subtitle/registry
strings that currently say "for each new hire" to reflect that these are the manager's own
onboarding tasks (purely cosmetic; logic unchanged).

---

## Build steps (each with a verify check)
1. **Migration + types** → apply locally; `\d manager_self_tasks` shows UNIQUE + index; RLS enabled.
2. **RLS smoke test** → manager A can insert own row; can't insert for manager B (WITH CHECK
   rejects); new hire sees nothing; admin sees all.
3. **Service** → `tsc --noEmit` clean; `reconcileSelfTasks` returns one row per task with
   computed `due_date`; calling twice doesn't duplicate.
4. **Hook** → `tsc` clean; mounts and reports `{ tasks, anchorMissing, loading }`.
5. **Tab wiring** → `?tab=my-tasks` lands on the new section; switching updates the URL; no console errors.
6. **My Manager Path UI** → renders; toggling completes + confetti + persists across reload; progress
   matches; empty/loading states correct.
7. **Calendar** → a self-task due this week appears on Week at a Glance styled as "My Tasks";
   clicking opens My Manager Path; hire tasks (manager-led + live calls) still appear and still open the hire.
8. **Drift check** → admin adds a task → appears on reload; soft-delete → disappears (no blank
   card), row remains in DB.
9. **Admin copy** → strings read correctly; `tsc` + lint clean.
10. **Regression** → My Team grid, per-hire tracker all unchanged.

---

## Risks & open questions
1. **Shared task pool** — manager tasks feed both the personal path and the per-hire flow. A
   task worded "Schedule 1:1 with new hire" would appear on the personal path. v1 accepts this;
   if the two lists must diverge later, add an `applies_to ('self'|'hire'|'both')` column + one
   admin selector.
2. **Profile-merge re-pointing** — covered by the in-migration comment; action only needed when
   the next merge migration is written.
3. **No start_date managers** — handled by today-fallback + suppressed overdue styling; rare
   since managers are hired with a start date.
