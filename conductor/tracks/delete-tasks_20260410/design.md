---
track_id: delete-tasks_20260410
created: 2026-04-10T07:30:00Z
status: approved
---

# Soft Delete Training Modules

## Problem Statement
Admins cannot delete training modules. Hard delete is dangerous — CASCADE on user_modules and module_comments destroys all student progress and feedback.

## Approach
Soft delete with `deleted_at` column. Module stays in DB but hidden from views.

## Changes (7 files + 1 migration)

1. Migration `016_soft_delete_modules.sql` — add `deleted_at TIMESTAMPTZ`
2. `types/database.ts` — add `deleted_at` to types
3. `moduleService.ts` — `getModules(includeDeleted)`, `deleteModule()`, `restoreModule()`
4. `cohortService.ts` — filter deleted in training_modules query
5. `AdminDashboard.tsx` — delete button in edit modal, showDeleted toggle in Task Registry, restore button, use activeModules for calendar/stats
6. `lessonly-webhook` — NO change (must still match deleted modules)
7. `adminStatsMapper.ts` — verify uses getModules() default (filters deleted)
