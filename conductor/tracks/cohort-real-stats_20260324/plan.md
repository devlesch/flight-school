# Plan: Cohort Page — Real Stats Per Leader Slot

Track: `cohort-real-stats_20260324`

---

## Phase 1: Compute & Wire Real Cohort Stats

- [x] Task 1.1: Add `useMemo` for cohort slot stats computation
  - [x] Uses existing local `isHireBehind` (no import needed — already defined in component)
  - [x] Create `cohortSlotStats` useMemo keyed by `cohortId-leaderId`
  - [x] Filter students by cohort date range (startDate within hire_start_date/hire_end_date)
  - [x] Group by managerId, compute hireCount/avgProgress/onTrack/atRisk per leader

- [x] Task 1.2: Replace hash formula with real stats lookups
  - [x] Remove `const hash = (role.length * 7 + region.length * 13) % 30` block
  - [x] Replace `avgProgress`, `hireCount`, `onTrack`, `behind` with `cohortSlotStats.get()` lookups
  - [x] Default to 0 values for empty slots via `?? 0`

- [x] Task 1.3: Write source verification test
  - [x] Test: no hash formula (`role.length * 7`) exists in AdminDashboard
  - [x] Test: `cohortSlotStats` and `isHireBehind` referenced in cohort stats computation

- [ ] Task 1.4: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)
