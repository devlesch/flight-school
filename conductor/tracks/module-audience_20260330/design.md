---
track_id: module-audience_20260330
created: 2026-03-30T14:30:00Z
status: approved
---

# Module Audience Targeting (Cohort vs Direct Reports)

## Problem Statement
We are solving undifferentiated module assignment for admins and managers because cohort training and direct report tasks serve different purposes but currently all modules show to all students regardless of their relationship to the manager.

## Success Criteria
- [ ] Task Builder has an "Audience" field: All / Cohort / Direct Reports
- [ ] `training_modules` table has an `audience` column (nullable, defaults null = all)
- [ ] Cohort students only see modules with audience null or 'cohort'
- [ ] Direct report students only see modules with audience null or 'direct'
- [ ] Students who are both see all modules
- [ ] Existing modules continue working (null = show to everyone)

## Out of Scope
- Per-student module assignment (individual targeting)
- Fixing target_role filtering (separate track)
- Module visibility in admin views (admin always sees all)

## Chosen Approach
Database column + service-layer filter. Add `audience TEXT` to `training_modules` (nullable). Filter in service layer based on member source.

## Design

### Architecture Overview

```
Admin creates module → audience column set ('cohort'/'direct'/null)
                              ↓
Manager view: getCohortMembersForManager()
  → For each member, filter modules by member.source + module.audience
  → cohort member sees: audience=null OR audience='cohort'
  → direct report sees: audience=null OR audience='direct'
  → both sees: all modules

Student view: getModulesWithProgress()
  → Determine student's relationship type
  → Filter modules accordingly
```

### Components

1. **Migration: `015_add_module_audience.sql`**
   - `ALTER TABLE training_modules ADD COLUMN audience TEXT;`
   - Nullable — null means "all students"

2. **`types/database.ts`** — Add `audience` field

3. **`components/AdminDashboard.tsx`** — Task Builder
   - Add "Audience" dropdown: All Students / Cohort Only / Direct Reports Only

4. **`services/cohortService.ts`** — Filter modules per member source

5. **`services/moduleService.ts`** — Audience-aware fetch for student view

6. **`components/NewHireDashboard.tsx`** — Use filtered modules

### Data Model

```sql
ALTER TABLE training_modules ADD COLUMN audience TEXT;
-- Values: 'cohort', 'direct', or NULL (all students)
```

## Grounding Notes
- `target_role` column exists on `training_modules` but is not used for filtering
- `CohortMember.source` field added recently: 'cohort' | 'direct' | 'both'
- Task Builder form at AdminDashboard lines ~1217-1256
- Module creation at AdminDashboard lines ~567-573

## Risks & Open Questions
- Student view needs to determine relationship type — may need a new service call or pass-through from cohort data
