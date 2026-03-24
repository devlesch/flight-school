# Plan: Admin Dashboard — Real Data & AI Analytics

Track: `admin-dashboard-data_20260324`

---

## Phase 1: Data Mapper — `adminStatsMapper.ts`

Build the pure function that transforms Supabase data shapes into `NewHireProfile[]`.

- [x] Task 1.1: Write unit tests for `mapToNewHireProfiles()`
  - [x] Test: maps Profile + UserModule[] to NewHireProfile with correct field names (manager_id → managerId, start_date → startDate)
  - [x] Test: computes progress as average module completion % per student
  - [x] Test: handles student with zero modules → progress = 0%
  - [x] Test: handles null/undefined fields gracefully (no avatar, no department)
  - [x] Test: groups modules by user_id correctly across multiple students
  - [x] Test: maps module due_date for overdue detection
  - [x] Test: sets managerTasks to empty array

- [x] Task 1.2: Implement `services/adminStatsMapper.ts`
  - [x] Create `mapToNewHireProfiles(profiles: Profile[], userModules: UserModuleWithDetails[]): NewHireProfile[]`
  - [x] Group user_modules by user_id
  - [x] Map each Profile to NewHireProfile with enriched module data
  - [x] Compute per-student progress percentage

- [x] Task 1.3: Write unit tests for `computeAdminStats()`
  - [x] Test: computes activeCount as total student count
  - [x] Test: computes avgProgress as mean of all student progress values
  - [x] Test: computes atRiskCount using isHireBehind logic (progress < 25% or overdue module)
  - [x] Test: handles empty array → { activeCount: 0, avgProgress: 0, atRiskCount: 0 }

- [x] Task 1.4: Implement `computeAdminStats()` in adminStatsMapper.ts
  - [x] Accept NewHireProfile[] and return { activeCount, avgProgress, atRiskCount }
  - [x] Extract isHireBehind logic into reusable function

- [ ] Task 1.5: Conductor - User Manual Verification 'Phase 1: Data Mapper' (Protocol in workflow.md)

---

## Phase 2: Admin Dashboard Hook — `useAdminDashboard.ts`

Compose existing hooks with the mapper to provide a single data source for AdminDashboard.

- [x] Task 2.1: Write unit tests for `useAdminDashboard()`
  - [x] Test: returns loading=true initially, then loading=false with data
  - [x] Test: returns correct students array (mapped NewHireProfile[])
  - [x] Test: returns correct stats (activeCount, avgProgress, atRiskCount)
  - [x] Test: returns error state when useAllUsers fails
  - [x] Test: returns error state when getUserModulesBatch fails
  - [x] Test: refetch triggers fresh data load
  - [x] Test: handles empty users list gracefully

- [x] Task 2.2: Implement `hooks/useAdminDashboard.ts`
  - [x] Compose useAllUsers() for profiles
  - [x] Call getUserModulesBatch(userIds) with training module join
  - [x] Pass results through mapToNewHireProfiles()
  - [x] Compute stats via computeAdminStats()
  - [x] Return { students, stats, loading, error, refetch }

- [ ] Task 2.3: Conductor - User Manual Verification 'Phase 2: Admin Dashboard Hook' (Protocol in workflow.md)

---

## Phase 3: Wire AdminDashboard Component

Replace mock data with the new hook and update KPI rendering.

- [ ] Task 3.1: Update AdminDashboard tests for real data integration
  - [ ] Mock useAdminDashboard instead of useAllUsers + mock constants
  - [ ] Test: KPI cards render stats from hook (activeCount, avgProgress, atRiskCount)
  - [ ] Test: loading state shows skeleton/spinner
  - [ ] Test: error state shows error banner
  - [ ] Test: empty state (0 students) renders zero KPIs
  - [ ] Test: "Execute Analysis" button passes real students to analyzeProgress

- [ ] Task 3.2: Modify AdminDashboard.tsx — remove mock imports, wire hook
  - [ ] Remove imports: NEW_HIRES, MANAGERS, MOCK_TRAINING_MODULES, MANAGER_ONBOARDING_TASKS from constants.ts
  - [ ] Replace useAllUsers() call with useAdminDashboard()
  - [ ] Replace enrolledCount with stats.activeCount
  - [ ] Replace avgCompletion calculation with stats.avgProgress
  - [ ] Replace behindCount with stats.atRiskCount
  - [ ] Update analyzeProgress() call to use students from hook

- [ ] Task 3.3: Add loading and error states
  - [ ] Show skeleton cards while loading
  - [ ] Show error banner with retry on Supabase failure
  - [ ] Disable AI button when no students or loading

- [ ] Task 3.4: Verify all remaining AdminDashboard references to mock data
  - [ ] Grep for NEW_HIRES, MANAGERS, MOCK_TRAINING_MODULES in AdminDashboard
  - [ ] Update any remaining mock references to use hook data
  - [ ] Ensure no constants.ts imports remain

- [ ] Task 3.5: Conductor - User Manual Verification 'Phase 3: Wire AdminDashboard' (Protocol in workflow.md)

---

## Phase 4: Integration Verification & Cleanup

End-to-end verification that all KPIs and AI analytics work with real data.

- [ ] Task 4.1: Run full test suite and verify coverage
  - [ ] All existing tests pass
  - [ ] New tests pass
  - [ ] Coverage meets 80% threshold for new files

- [ ] Task 4.2: Manual verification checklist
  - [ ] Build succeeds without warnings (npm run build)
  - [ ] No TypeScript errors
  - [ ] No console.log debug statements left

- [ ] Task 4.3: Conductor - User Manual Verification 'Phase 4: Integration Verification' (Protocol in workflow.md)
