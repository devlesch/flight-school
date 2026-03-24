---
track_id: newhire-real-data_20260323
created: 2026-03-23
status: approved
---

# New Hire Dashboard — Real Data Integration

## Problem Statement

We are solving incomplete real-data integration in the NewHireDashboard for new hire users because the dashboard still renders hardcoded mock data for manager info, leadership team, and profile fallback from `constants.ts`, making it unusable for real employees and inconsistent with the already-migrated ManagerDashboard.

## Success Criteria

- [ ] Manager info (name, avatar, title) rendered from Supabase `profiles` table, not `MANAGERS` array
- [ ] Leadership team (RD, GM, AGM) fetched from Supabase profiles using `standardized_role`, not hardcoded lookups
- [ ] Mock profile fallback (`NEW_HIRES.find(...)`) removed; replaced with explicit defaults for null fields
- [ ] `NEW_HIRES` and `MANAGERS` imports removed from NewHireDashboard
- [ ] `UNIVERSAL_SERVICE_STEPS` kept as constant (static UI content, not user data) with inline comment explaining why
- [ ] Graceful fallback states when manager or leadership data is null/empty
- [ ] Existing tests pass; new tests cover real-data paths
- [ ] Structural test verifies mock arrays are not imported

## Out of Scope

- Admin or Manager dashboard mock data migration (separate tracks)
- Real-time subscriptions / live updates
- New database tables or schema changes (use existing `profiles` table)
- OKR display in NewHireDashboard (not currently rendered)
- Manager task view from new hire perspective

## Chosen Approach

**Option A: Hook-Per-Concern** — Add one new hook (`useLeadershipTeam`) for leadership team data, reuse existing `useProfile(managerId)` for manager lookup, and wire the existing `useOkrs` hook for future use. Replace mock imports incrementally. Keep `UNIVERSAL_SERVICE_STEPS` as a constant.

## Design

### Architecture Overview

Incrementally replace 3 mock data sources in NewHireDashboard with Supabase-backed hooks, following the existing hook → service → Supabase pattern.

**Changes:**
```
hooks/
└── useLeadershipTeam.ts   (NEW) — fetches leadership profiles by region/standardized_role

components/
└── NewHireDashboard.tsx   (MODIFY) — wire hooks, remove mock imports, explicit defaults

services/
└── teamService.ts         (EXTEND) — add getProfilesByRegion() query
```

No new database tables. No schema changes. Existing `getProfile()` and `getProfilesByRole()` services cover manager lookup.

### Components

**Reused Hook: `useProfile(managerId)`**
- Already exists — calls `getProfile(managerId)` from profileService
- Returns `{ profile: Profile | null, loading, error }`
- Used to replace `MANAGERS.find(m => m.id === myProfile.managerId)` on line 71

**New Hook: `useLeadershipTeam(region)`**
- Queries `profiles` table filtered by region and `standardized_role` in ('Regional Director', 'General Manager', 'Assistant General Manager')
- Uses new `getProfilesByRegion(region)` service method in teamService.ts
- Returns `{ leaders: { profile: Profile, roleLabel: string }[], loading, error }`
- Replaces hardcoded `rd`, `gm`, `agm` lookups on lines 140-142

**Modified: `NewHireDashboard.tsx`**
- Import `useLeadershipTeam` (new) and second `useProfile` call for manager
- Remove `NEW_HIRES` and `MANAGERS` imports from constants
- Keep `UNIVERSAL_SERVICE_STEPS` import with comment: `// Static UI content — intentionally kept as constant`
- Replace `...mockProfile` spread (line 33) with explicit default values for null fields
- Replace `myManager` lookup (line 71) with `useProfile(myProfile.managerId)` result
- Replace `unitLeaders` array (lines 140-148) with `useLeadershipTeam(myProfile.region)` result

### Data Model

No new database types. All data from existing `profiles` table.

**Key fields used:**
- `profiles.manager_id` → resolve manager via `getProfile()`
- `profiles.standardized_role` → filter leadership team (reliable vs. free-text `title`)
- `profiles.region` → scope leadership query to same region as new hire

**New service method:**
```typescript
// teamService.ts
export async function getProfilesByRegion(region: string): Promise<Profile[]>
// Queries profiles WHERE region = region AND standardized_role IN (...)
```

### User Flow

1. New hire logs in → `useProfile(user.id)` fetches their profile (existing, unchanged)
2. Profile loads → `manager_id` available → `useProfile(managerId)` fetches manager's profile
3. Profile loads → `region` available → `useLeadershipTeam(region)` fetches leadership chain
4. Dashboard renders with real manager name/avatar in "My Manager" card
5. Leadership team section shows real RD/GM/AGM from Supabase
6. If manager or leadership data is null → show "Not assigned" placeholder (no crash, no fake data)

### Error Handling

| Scenario | Behavior |
|----------|----------|
| `manager_id` is null | Show "No manager assigned" in manager card |
| Manager profile not found | Show "Manager" with placeholder avatar |
| Leadership team query returns empty | Show "Leadership team not available" |
| `region` is null | Skip leadership query, show empty state |
| Supabase network error | Show existing error banner (ConnectionStatus) |
| Profile still loading | Show skeleton/spinner consistent with existing loading states |

Key principle: Never fall back to mock data. Show honest empty states instead.

### Testing Strategy

| Test | Type | Description |
|------|------|-------------|
| `useLeadershipTeam` returns filtered profiles | Unit | Mock Supabase, verify region + standardized_role filter |
| `useLeadershipTeam` handles null region | Unit | Verify no fetch, returns empty array |
| `useProfile(managerId)` fetches manager | Unit | Verify getProfile called with correct ID |
| NewHireDashboard renders with real manager | Integration | Provide mock hook returns, verify manager card |
| NewHireDashboard handles missing manager | Integration | Null manager, verify fallback UI |
| NewHireDashboard no longer imports mock arrays | Structural | Verify `NEW_HIRES` and `MANAGERS` not imported |
| Explicit defaults used for null profile fields | Unit | Verify no `...mockProfile` spread |

Coverage target: 80% (per workflow.md)

## Grounding Notes

- `getProfile(userId)` exists at `services/profileService.ts:31` — confirmed
- `getProfilesByRole(role)` exists at `services/teamService.ts:96` — confirmed
- `profiles` table has `standardized_role`, `region`, `title` fields — confirmed in `types/database.ts`
- `useOkrs` hook exists at `hooks/useOkrs.ts:15` but OKRs are not rendered in NewHireDashboard — out of scope
- `UNIVERSAL_SERVICE_STEPS` is static UI content (icon + title + description) — stays as constant

## Party Panel Insights

- **Reuse `useProfile`** for manager lookup instead of creating a new hook (Frontend Developer)
- **Use `standardized_role`** not `title` for leadership queries — titles may vary (Murat/QA)
- **Replace `...mockProfile` spread** with explicit defaults — cleaner, no hidden mock dependency (Murat/QA)
- **Add structural import test** to prevent regression of mock array re-introduction (Reality Checker)
- **Keep `UNIVERSAL_SERVICE_STEPS`** as constant with documentation comment (Winston/Architect)

## Risks & Open Questions

1. **Data availability:** If `standardized_role` is not consistently populated in production `profiles` table, leadership queries will return empty. Mitigation: verify data before deployment, fall back gracefully.
2. **Region scoping:** If a new hire's `region` is null, leadership team cannot be queried. Mitigation: skip query, show empty state.
3. **Profile shape compatibility:** The `NewHireProfile` type from `types.ts` has fields (modules, okrs, shoutouts) that don't map to the database `Profile` type. The component will need careful type handling during the mock-to-real transition.
