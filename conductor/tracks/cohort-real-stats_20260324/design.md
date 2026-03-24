---
track_id: cohort-real-stats_20260324
created: 2026-03-24
status: approved
---

# Cohort Page — Real Stats Per Leader Slot

## Problem Statement

We are solving **fake cohort performance stats** for **Operations/HR Admins** because the cohort page uses a deterministic hash formula (`55 + (role.length * 7 + region.length * 13) % 30`) to generate Progress/Hires/OnTrack/AtRisk values per leader slot instead of querying real student data from Supabase.

## Success Criteria

- [ ] Each cohort leader slot shows real member count from profiles matching that leader
- [ ] Progress % reflects actual average module completion for those members
- [ ] On Track / At Risk counts use the same `isHireBehind()` logic as the dashboard KPIs
- [ ] Zero hardcoded hash formulas remain in the cohort stats rendering
- [ ] Empty cohorts/slots show 0 values gracefully

## Out of Scope

- New Supabase queries or services (reuse existing `useAdminDashboard`)
- Cohort directory table changes (already real data)
- Leader assignment UI changes
- Per-member drill-down within cohort view (already exists)

## Chosen Approach

**Option A: Filter existing `students` data in-component** — Use the already-loaded `useAdminDashboard().students` array. Create a `useMemo` that builds a stats map keyed by leader profile_id, filtering students by cohort date range and managerId. Replace hash formula with map lookups. Zero new queries, minimal code change.

## Design

### Architecture Overview

```
AdminDashboard.tsx (cohort view)
  └── students (from useAdminDashboard, already loaded at component mount)
        └── cohortSlotStats = useMemo(() => {
              // For each cohort → filter students by startDate in [hire_start_date, hire_end_date]
              // For each leader slot → filter by managerId === leader.profile_id
              // Compute: hireCount, avgProgress, onTrack, atRisk via isHireBehind()
            }, [students, cohorts])
              └── Replace hash formula with cohortSlotStats.get(leaderId) lookups
```

### Components

| File | Change Type | Description |
|---|---|---|
| `components/AdminDashboard.tsx` | **MODIFY** | Replace hash formula (~lines 1198-1236) with `useMemo` stats lookup. Import `isHireBehind` from `adminStatsMapper.ts`. |

### Data Flow

1. `useAdminDashboard()` already returns `students: NewHireProfile[]` with `managerId`, `startDate`, `progress`, `modules[]`
2. `useCohorts()` already returns `cohorts: CohortWithLeaders[]` with `hire_start_date`, `hire_end_date`, and `cohort_leaders[].profile_id`
3. New `useMemo` computes `Map<string, { hireCount, avgProgress, onTrack, atRisk }>`:
   - For each cohort, filter students where `startDate` falls within `[hire_start_date, hire_end_date]`
   - For each leader in cohort, filter those students by `managerId === leader.profile_id`
   - Compute stats using `isHireBehind()` from `services/adminStatsMapper.ts`
4. In JSX, replace `const hash = ...` block with `const slotStats = cohortSlotStats.get(leader.profile_id) || defaults`

### Error Handling

| Scenario | Handling |
|---|---|
| No students loaded yet | Stats show 0/0%/0 |
| Leader with no assigned students | Stats show 0/0%/0 |
| Cohort with no date range match | Stats show 0/0%/0 |

### Testing Strategy

| Test | Type | What it Verifies |
|---|---|---|
| Source verification test | Unit | No hash formula remains in cohort stats section |

## Grounding Notes

- `useAdminDashboard()` is called unconditionally at the top of AdminDashboard — available in all view modes
- Hash formula is at ~lines 1198-1236: `const hash = (role.length * 7 + region.length * 13) % 30`
- `isHireBehind()` already exported from `services/adminStatsMapper.ts`
- `getCohortMembersForManager()` in cohortService.ts uses `startDate >= hire_start_date && startDate <= hire_end_date` for date matching

## Party Panel Insights

- **Consensus:** Reuse existing `useAdminDashboard().students` — no new queries.
- **Key insight:** Filter students by cohort date range first, then by `managerId === leader.profile_id` per slot.
- **Reuse:** Import `isHireBehind` from `adminStatsMapper.ts` (built in previous track).

## Risks & Open Questions

- None significant — straightforward data piping change with existing infrastructure.
