# Spec: Cohort Page — Real Stats Per Leader Slot

## Overview

Replace the hardcoded hash-formula stats (Progress %, Hires, On Track, At Risk) in the cohort page's leader slot cards with real data computed from `useAdminDashboard().students`, filtered by cohort date range and leader assignment.

## Functional Requirements

### FR-1: Cohort Slot Stats Computation
Add a `useMemo` in AdminDashboard that computes per-leader-slot stats:
- Filters `students` by cohort date range (`startDate` within `hire_start_date` to `hire_end_date`)
- Groups filtered students by `managerId === leader.profile_id`
- Computes per-slot: `hireCount`, `avgProgress`, `onTrack`, `atRisk`
- Uses `isHireBehind()` from `adminStatsMapper.ts` for at-risk detection

### FR-2: Replace Hash Formula
Remove the deterministic hash computation (`const hash = (role.length * 7 + region.length * 13) % 30`) and replace with real stats map lookups.

## Acceptance Criteria

- [ ] AC-1: Each leader slot shows real hire count matching students assigned to that leader
- [ ] AC-2: Progress % reflects real average module completion for slot members
- [ ] AC-3: On Track / At Risk uses `isHireBehind()` logic consistently with dashboard KPIs
- [ ] AC-4: No hardcoded hash formula remains in cohort stats code
- [ ] AC-5: Empty slots (no leader or no students) show 0/0%/0 gracefully

## Out of Scope

- New Supabase queries or services
- Cohort directory table changes
- Leader assignment UI changes
- Per-member drill-down changes
