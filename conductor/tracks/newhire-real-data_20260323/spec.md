# Specification: New Hire Dashboard — Real Data Integration

## Overview

Replace remaining mock/hardcoded data in the NewHireDashboard component with real Supabase data, following the hook → service → Supabase pattern already established in the ManagerDashboard. The NewHireDashboard currently uses 4 real-data hooks (`useProfile`, `useModules`, `useWorkbook`, `useShoutouts`) but still imports 3 mock arrays from `constants.ts` (`NEW_HIRES`, `MANAGERS`, `UNIVERSAL_SERVICE_STEPS`).

## Background

The Supabase Backend Integration track (completed 2026-01-31) established the data layer — database tables, services, hooks, and authentication. The ManagerDashboard was wired to real data during that effort, but the NewHireDashboard was only partially migrated. Mock data remains for manager info, leadership team, and profile fallback, making the dashboard unusable for real employees.

## Functional Requirements

### FR1: Manager Profile Resolution
- The new hire's manager must be fetched from Supabase using `manager_id` from the new hire's profile
- Reuse existing `useProfile(managerId)` hook — no new hook needed
- The "My Manager" card must display real name, avatar, and title from the `profiles` table
- If `manager_id` is null, show "No manager assigned" placeholder
- If manager profile is not found, show "Manager" with placeholder avatar

### FR2: Leadership Team from Supabase
- Leadership team (Regional Director, General Manager, Assistant General Manager) must be fetched from Supabase
- Query `profiles` table filtered by `region` (matching new hire's region) and `standardized_role` field
- Use `standardized_role` (not free-text `title`) for reliable matching
- Create new `useLeadershipTeam(region)` hook
- Add `getLeadershipByRegion(region)` service method to `teamService.ts`
- Returns array of `{ profile: Profile, roleLabel: string }`
- If region is null, skip query and show empty state
- If query returns empty, show "Leadership team not available"

### FR3: Remove Mock Profile Fallback
- Remove `NEW_HIRES.find(...)` fallback on line 27 of NewHireDashboard
- Replace `...mockProfile` spread with explicit default values for null profile fields
- When `supabaseProfile` is null/loading, show loading spinner — never fall back to mock data
- Define explicit defaults: empty string for name/email, placeholder URL for avatar, etc.

### FR4: Clean Up Mock Imports
- Remove `NEW_HIRES` and `MANAGERS` imports from NewHireDashboard
- Keep `UNIVERSAL_SERVICE_STEPS` import with inline comment: `// Static UI content — intentionally kept as constant`
- Ensure no other references to removed mock arrays remain in the component

## Non-Functional Requirements

### NFR1: Consistency
- Follow the same hook pattern used by existing hooks (`useState` + `useEffect` + `useCallback`)
- Consistent loading/error state handling across all hooks
- Match existing code style and TypeScript patterns

### NFR2: Performance
- Manager profile fetch happens in parallel with leadership team fetch (both triggered after profile loads)
- No waterfall requests beyond the necessary profile → dependent data chain

### NFR3: Type Safety
- New hook and service method must be fully typed
- No `any` casts — use `Profile` type from `types/database.ts`

## Technical Constraints

- Use existing `profiles` table — no schema changes
- Use existing `getProfile()` from `profileService.ts` for manager lookup
- Use existing Supabase client from `lib/supabase.ts`
- `standardized_role` field values must match: 'Regional Director', 'General Manager', 'Assistant General Manager'

## Acceptance Criteria

- [ ] AC1: Manager card shows real manager name and avatar from Supabase
- [ ] AC2: Manager card shows "No manager assigned" when `manager_id` is null
- [ ] AC3: Leadership team section shows real RD/GM/AGM from Supabase filtered by region
- [ ] AC4: Leadership section shows empty state when no leaders found or region is null
- [ ] AC5: `NEW_HIRES` and `MANAGERS` are not imported in NewHireDashboard
- [ ] AC6: `UNIVERSAL_SERVICE_STEPS` remains imported with explanatory comment
- [ ] AC7: No `...mockProfile` spread — explicit defaults for null fields
- [ ] AC8: Loading spinners shown while manager and leadership data loads
- [ ] AC9: All existing tests pass
- [ ] AC10: New unit tests for `useLeadershipTeam` hook (region filter, null region, empty results)
- [ ] AC11: New integration test verifying NewHireDashboard renders with real hook data
- [ ] AC12: Structural test verifying mock arrays are not imported in NewHireDashboard
- [ ] AC13: Test coverage meets 80% threshold

## Out of Scope

- Admin or Manager dashboard mock data migration
- Real-time subscriptions / live updates
- New database tables or schema changes
- OKR display in NewHireDashboard (not currently rendered)
- Manager task view from new hire perspective
- Migration of `UNIVERSAL_SERVICE_STEPS` to database

## Dependencies

- Existing `profiles` table with `standardized_role`, `region`, `manager_id` fields populated
- Existing `profileService.ts` with `getProfile()` method
- Existing `teamService.ts` (will be extended)
