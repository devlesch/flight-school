---
track_id: manager-real-data_20260323
created: 2026-03-23
status: approved
---

# Wire Manager Dashboard with Real Supabase Data

## Problem Statement
The Manager Dashboard shows fake data from `constants.ts` (`NEW_HIRES`, `MANAGERS`) instead of querying Supabase's cohort-based relationships. It uses the wrong data model (`profiles.manager_id`) instead of the correct chain: manager → `cohort_leaders` → `cohorts` → `profiles` by date range. Overdue calculations use a hardcoded mock date instead of `new Date()`.

## Success Criteria
- [ ] Manager Dashboard shows students from their assigned cohort(s) via cohort_leaders → cohorts → profiles date range matching
- [ ] Student progress reflects real `user_modules` completion data
- [ ] Overdue calculations use `new Date()` instead of hardcoded `Jan 5, 2026`
- [ ] Reassign modal lists real cohort leaders from Supabase
- [ ] `constants.ts` imports (`NEW_HIRES`, `MANAGERS`) removed from ManagerDashboard.tsx
- [ ] Empty states rendered when manager has no cohort or cohort has no students
- [ ] Cohort name displayed in the UI

## Out of Scope
- Changing the Admin Dashboard's cohort logic (it already works)
- Adding new database tables or schema changes
- Real-time/subscription-based updates
- Workbook or OKR data wiring (separate tracks)

## Chosen Approach
**Option A: New `useCohortTeam` Hook + Shared Service**

Create `getCohortMembersForManager(managerId)` in `cohortService.ts` that resolves the full chain (manager → cohort_leaders → cohorts → profiles by date range → user_modules progress). Create a `useCohortTeam` hook wrapping it. Replace `useTeam` + mock constants in ManagerDashboard.

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ ManagerDashboard.tsx                                     │
│  ├── useCohortTeam(managerId)  ← NEW (replaces useTeam) │
│  ├── useManagerTasks(managerId) ← EXISTING (unchanged)  │
│  └── Renders: team list, progress, tracker, reassign     │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│ hooks/useCohortTeam.ts  ← NEW                            │
│  Calls: getCohortMembersForManager()                     │
│  Returns: { members, cohort, leaders, loading, error }   │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│ services/cohortService.ts  ← EXTENDED                    │
│  getCohortMembersForManager(managerId):                  │
│    1. Query cohort_leaders WHERE profile_id = managerId  │
│    2. Get cohort(s) with date ranges                     │
│    3. Query profiles WHERE start_date IN range           │
│    4. Enrich with user_modules progress + training_modules│
│  Returns: { cohort, members: CohortMember[], leaders }   │
└─────────────────────────────────────────────────────────┘
```

### Components

1. **`services/cohortService.ts`** (extended) — new `getCohortMembersForManager(managerId)` function that resolves the full query chain and returns enriched member data with progress and module details

2. **`hooks/useCohortTeam.ts`** (new) — React hook wrapping the service call, returns `{ members, cohort, leaders, loading, error, refetch }`

3. **`components/ManagerDashboard.tsx`** (modified) — replace `useTeam` + `NEW_HIRES`/`MANAGERS` with `useCohortTeam`; fix date calculations using `cohort.starting_date`; add empty states; show cohort name

### Data Model

```typescript
// In services/cohortService.ts
export interface CohortMember {
  profile: Profile;
  progress: number;                    // 0-100 percentage
  modules: UserModuleWithDetails[];    // user_modules joined with training_modules
}

export interface UserModuleWithDetails {
  id: string;                          // user_module id
  moduleId: string;                    // training_module id
  title: string;
  description: string;
  type: string;
  duration: string;
  completed: boolean;
  completedAt: string | null;
  dueDate: string;                     // cohort.starting_date + module.day_offset
  link: string | null;
  host: string | null;
}

export interface ManagerCohortData {
  cohort: Cohort;
  members: CohortMember[];
  leaders: (CohortLeader & { profile: Profile })[];
}
```

### User Flow

1. Manager logs in → ManagerDashboard mounts → `useCohortTeam(user.id)` fires
2. Service resolves: cohort_leaders → cohort → profiles (by date range, role = 'New Hire') → user_modules + training_modules
3. Dashboard renders real students with real progress bars
4. Due dates computed: `cohort.starting_date + module.day_offset`
5. Overdue check: due date vs `new Date()`
6. Reassign modal: `leaders` from cohort data (real profiles)
7. Empty state: if no cohort → "You're not assigned to a cohort yet"

### Error Handling

- No cohort assignment → empty state with message
- Supabase query failure → error with retry button
- No students in cohort → "No New Bees in this cohort yet"
- `cohort.starting_date` is null → use `hire_start_date` as fallback for due dates
- Profile with `start_date = null` → excluded from cohort membership

### Testing Strategy

- Unit test `getCohortMembersForManager`: mock Supabase queries, verify query chain
- Unit test `useCohortTeam`: verify loading/error/data states
- Unit test ManagerDashboard: verify renders real data, empty states, overdue indicators
- Integration test: full flow manager → cohort → students → progress

## Grounding Notes

- AdminDashboard line 280-286 already implements cohort member date range filter — reuse pattern
- `training_modules.day_offset` exists (migration 011) — used for due date computation
- `cohorts.starting_date` exists — baseline for module scheduling
- `CohortLeader` type has `profile_id`, `role_label`, `region` — sufficient for reassign modal
- `getCohortsWithLeaders()` already exists in cohortService.ts — can extend or compose

## Party Panel Insights

- **Winston:** Extract Admin's cohort member query into reusable service; `ManagerCohortData` type is the right shape
- **Data Engineer:** Use `cohort.starting_date` as baseline for task due dates; extract shared module join utility
- **Murat:** Surface cohort name in UI; audit all constants.ts usage before removing
- **Reality Checker:** Verify welcome guide and other UI elements don't depend on removed constants

## Risks & Open Questions

- Manager assigned to multiple cohorts — design shows most recent; may need cohort switcher later
- `useManagerTasks` hook uses `managerId` to fetch tasks — verify it works with the cohort model or if tasks also need cohort-based resolution
