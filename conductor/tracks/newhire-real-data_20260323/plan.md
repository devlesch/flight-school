# Implementation Plan: New Hire Dashboard — Real Data Integration

## Phase 1: Service Layer — Leadership Query

### Task 1.1: Write tests for `getLeadershipByRegion` service method
- [x] Create `tests/unit/teamService.test.ts`
- [x] Test: returns profiles filtered by region and standardized_role
- [x] Test: returns empty array when no matching profiles found
- [x] Test: returns empty array when Supabase returns null data
- [x] Test: handles Supabase error gracefully (returns empty array)

### Task 1.2: Implement `getLeadershipByRegion` in teamService.ts
- [x] Add `getLeadershipByRegion(region: string): Promise<Profile[]>` to `services/teamService.ts`
- [x] Query `profiles` table with `.eq('region', region)` and `.in('standardized_role', ['Regional Director', 'General Manager', 'Assistant General Manager'])`
- [x] Return typed `Profile[]`, empty array on error
- [x] Verify all tests from 1.1 pass

### Task 1.3: Conductor — User Manual Verification 'Phase 1' (Protocol in workflow.md)
- [x] All phase tasks completed with commit 7e6b4cb
- [x] New tests pass (4/4)
- [x] Pre-existing test failures unrelated (missing Supabase env vars)

---

## Phase 2: Hook Layer — useLeadershipTeam

### Task 2.1: Write tests for `useLeadershipTeam` hook
- [x] Create `tests/unit/useLeadershipTeam.test.ts`
- [x] Test: calls `getLeadershipByRegion` with provided region
- [x] Test: returns `{ leaders, loading, error }` with correct types
- [x] Test: maps profiles to `{ profile, roleLabel }` using `standardized_role`
- [x] Test: returns empty leaders array when region is null (no fetch)
- [x] Test: returns empty leaders array when service returns empty
- [x] Test: sets error state on service failure

### Task 2.1b: Write tests for `useProfileById` hook (added — useProfile can't fetch by arbitrary ID)
- [x] Create `tests/unit/useProfileById.test.ts`
- [x] Test: fetches profile by ID
- [x] Test: returns null when userId is null/undefined
- [x] Test: sets error state on service failure

### Task 2.2: Implement `useLeadershipTeam` hook
- [x] Create `hooks/useLeadershipTeam.ts`
- [x] Follow existing hook pattern: `useState` + `useEffect` + `useCallback`
- [x] Import `getLeadershipByRegion` from `teamService`
- [x] Return `{ leaders: LeaderProfile[], loading: boolean, error: string | null }`
- [x] Map each profile to `{ profile, roleLabel: profile.standardized_role }`
- [x] Skip fetch when region is null/undefined
- [x] Verify all tests pass

### Task 2.2b: Implement `useProfileById` hook (added)
- [x] Create `hooks/useProfileById.ts`
- [x] Wraps `getProfile(userId)` from profileService
- [x] Verify all tests pass

### Task 2.3: Conductor — User Manual Verification 'Phase 2' (Protocol in workflow.md)
- [x] All phase tasks completed
- [x] 10 hook tests pass (6 leadership + 4 profileById)

---

## Phase 3: Component Integration — Wire Hooks into NewHireDashboard

### Task 3.1: Write tests for NewHireDashboard with real data hooks
- [ ] Add integration test: dashboard renders manager name/avatar from `useProfile(managerId)` hook
- [ ] Add integration test: dashboard renders "No manager assigned" when `manager_id` is null
- [ ] Add integration test: dashboard renders leadership team from `useLeadershipTeam` hook
- [ ] Add integration test: dashboard renders leadership empty state when no leaders found
- [ ] Add structural test: verify `NEW_HIRES` and `MANAGERS` are NOT imported in NewHireDashboard.tsx

### Task 3.2: Wire manager profile hook into NewHireDashboard
- [ ] Add second `useProfile(myProfile.managerId)` call for manager data
- [ ] Replace `const myManager = MANAGERS.find(...)` (line 71) with hook result
- [ ] Add loading state for manager data
- [ ] Add "No manager assigned" fallback when manager is null

### Task 3.3: Wire leadership team hook into NewHireDashboard
- [ ] Import `useLeadershipTeam` hook
- [ ] Replace hardcoded `rd`, `gm`, `agm` lookups (lines 140-142) with `useLeadershipTeam(myProfile.region)` result
- [ ] Replace `unitLeaders` array (lines 144-148) with hook's `leaders` array
- [ ] Add "Leadership team not available" fallback for empty results

### Task 3.4: Remove mock profile fallback and clean up imports
- [ ] Remove `NEW_HIRES` and `MANAGERS` from the import statement on line 3
- [ ] Keep `UNIVERSAL_SERVICE_STEPS` with comment: `// Static UI content — intentionally kept as constant`
- [ ] Remove `const mockProfile = NEW_HIRES.find(...)` (line 27)
- [ ] Replace `...mockProfile` spread in `myProfile` useMemo with explicit defaults for null fields
- [ ] Ensure no remaining references to `NEW_HIRES` or `MANAGERS` in the component

### Task 3.5: Verify all tests pass
- [ ] Run full test suite: `npm test`
- [ ] Verify coverage threshold met: `npm run test:coverage`
- [ ] Fix any broken tests from mock removal

### Task 3.6: Conductor — User Manual Verification 'Phase 3' (Protocol in workflow.md)
