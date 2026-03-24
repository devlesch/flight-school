---
track_id: admin-dashboard-data_20260324
created: 2026-03-24
status: approved
---

# Admin Dashboard — Real Data & AI Analytics

## Problem Statement

We are solving **fictional admin metrics and useless AI analytics** for **Operations/HR Admins** because the Admin Dashboard still imports mock data (`NEW_HIRES`, `MANAGERS`) from `constants.ts`, making all KPIs inaccurate and the Gemini-powered progress analysis meaningless.

## Success Criteria

- [ ] Active Hires KPI shows count of real enrolled students from Supabase
- [ ] Avg Progress KPI shows real average completion % across all students' modules
- [ ] At Risk KPI shows count of students genuinely behind schedule
- [ ] "Execute Analysis" sends real student profiles to Gemini and returns actionable insights
- [ ] AdminDashboard no longer imports `NEW_HIRES` or `MANAGERS` from constants.ts
- [ ] Loading and error states shown while data fetches
- [ ] All new code has tests (80% coverage minimum)

## Out of Scope

- Server-side aggregate views/RPCs (optimize later if needed past 100+ students)
- Redesigning KPI cards or dashboard layout
- New KPIs beyond the existing 3 + AI analysis
- Modifying ManagerDashboard or NewHireDashboard (already wired)
- Caching strategy for AI results (enhancement for later)

## Chosen Approach

**Option A: Compose Existing Hooks** — Create a `useAdminDashboard()` hook that composes `useAllUsers()` + `getUserModulesBatch()`. Map results to `NewHireProfile[]` interface. Feed mapped data to KPI calculations and `analyzeProgress()`. Low-medium effort, low risk, follows established patterns from ManagerDashboard.

## Design

### Architecture Overview

```
AdminDashboard.tsx
  └── useAdminDashboard() hook (NEW)
        ├── useAllUsers() → profiles[] (EXISTING - already imported in AdminDashboard)
        ├── getUserModulesBatch(userIds) → user_modules[] (EXISTING)
        └── mapToNewHireProfiles(profiles, modules) → NewHireProfile[] (NEW mapper)
              ├── KPI calculations (Active, Avg Progress, At Risk)
              └── analyzeProgress(mappedProfiles) → AI insights (EXISTING, on-click)
```

The new hook supersedes the existing `useAllUsers()` call in AdminDashboard (line 61) to avoid duplicate fetching. It returns both mapped profiles and pre-computed stats.

### Components

| Component/Hook | Change Type | Description |
|---|---|---|
| `hooks/useAdminDashboard.ts` | **NEW** | Facade hook composing `useAllUsers()` + batch module progress. Returns `{ students, stats, loading, error }` |
| `services/adminStatsMapper.ts` | **NEW** | Maps Supabase `Profile + UserModule[]` → `NewHireProfile[]` interface |
| `components/AdminDashboard.tsx` | **MODIFY** | Replace mock imports with `useAdminDashboard()` hook. Remove `NEW_HIRES`/`MANAGERS` imports from constants.ts |
| `services/geminiService.ts` | **NO CHANGE** | Already accepts `NewHireProfile[]` — just needs real data passed in |
| `constants.ts` | **NO CHANGE** | Keep mock data for any other consumers; AdminDashboard stops importing it |

### Data Model

**Mapper bridges these shapes:**

Source (Supabase):
```typescript
// From useAllUsers() → Profile
{ id, email, name, role, avatar, title, region, location, manager_id, department, start_date }

// From getUserModulesBatch() → UserModule
{ id, user_id, module_id, status, completed_at, progress, score }
```

Target (App):
```typescript
// NewHireProfile (types.ts lines 75-88)
{ id, name, email, role, avatar, title, managerId, startDate, progress, department, modules[], managerTasks? }
```

The mapper:
- Groups `UserModule[]` by `user_id`
- Computes `progress` as average completion % across a student's modules
- Maps `TrainingModule[]` from joined module data (may need `training_modules` table for names/due dates)
- Sets `managerTasks` to `[]` for KPI calculations (not used by the 3 KPIs)
- For AI analysis, manager tasks can optionally be enriched via `getAllManagerTasks()`

**Hook return shape:**
```typescript
interface UseAdminDashboardReturn {
  students: NewHireProfile[];
  stats: {
    activeCount: number;
    avgProgress: number;
    atRiskCount: number;
  };
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

### User Flow

1. Admin navigates to Dashboard → `useAdminDashboard()` fires automatically
2. Skeleton/loading state shown while Supabase queries execute
3. KPI cards populate with real counts/percentages from `stats`
4. Admin clicks "Execute Analysis" → `analyzeProgress(students)` called with real mapped profiles
5. AI analysis panel shows genuine insights about real students
6. Admin can drill into individual student data (same UI, real numbers)

### Error Handling

| Scenario | Handling |
|---|---|
| Supabase query fails | Show error banner, KPIs show "--" |
| No students in database | KPIs show 0 / 0% / 0, AI button disabled with "No students to analyze" |
| Gemini API key missing | Already handled — returns "[AI disabled]" |
| Gemini API error | Already handled — returns error message in analysis panel |
| Partial module data | Progress defaults to 0% for students with no modules |
| Student with no manager_id | Still counted in Active Hires, progress still calculated |

### Testing Strategy

| Test | Type | What it Verifies |
|---|---|---|
| `adminStatsMapper.test.ts` | Unit | Supabase → NewHireProfile mapping; edge cases (no modules, null fields, empty arrays) |
| `useAdminDashboard.test.ts` | Unit | Hook returns correct stats, handles loading/error, computes KPIs accurately |
| `AdminDashboard.test.tsx` | Integration | KPIs render from hook data, AI button calls analyzeProgress with real-shaped data |

## Grounding Notes

- `useAllUsers()` already imported in AdminDashboard.tsx line 61 — hook exists alongside mock imports
- `getUserModulesBatch(userIds: string[])` confirmed in services/moduleService.ts lines 66-78
- `NewHireProfile` interface confirmed in types.ts lines 75-88
- `isHireBehind()` defined at AdminDashboard.tsx line 247 — uses `progress < 25 || modules.some(m => !m.completed && dueDate < now)`
- `analyzeProgress(hires: NewHireProfile[])` confirmed in geminiService.ts lines 123-157
- AdminDashboard imports both `useAllUsers()` AND mock `{ NEW_HIRES, MANAGERS, MOCK_TRAINING_MODULES, MANAGER_ONBOARDING_TASKS }` from constants.ts line 5
- No batch manager tasks service exists — only per-manager `getAllManagerTasks(managerId)`

## Party Panel Insights

- **Consensus:** Compose existing hooks (Option A). Low risk, follows ManagerDashboard patterns.
- **Key risk:** Module `dueDate` field may not exist in Supabase `user_modules` table — may need to join with `training_modules` table or derive from cohort start dates. This affects the At Risk KPI's `isHireBehind()` logic.
- **Recommendation:** Hook should return pre-computed stats alongside mapped profiles for clean component consumption.
- **Performance:** Client-side aggregation is fine for current scale (20-50 students). Gemini API call (1-3s) is the real bottleneck, already handled via on-click lazy loading.

## Risks & Open Questions

1. **Module due dates** — `isHireBehind()` checks `m.dueDate` but `user_modules` table may lack this field. Need to investigate `training_modules` schema for due date source during implementation.
2. **Manager tasks for AI** — `analyzeProgress()` references `managerTasks` in its prompt. Without batch fetching these, AI analysis may be less detailed. Acceptable for v1; can enrich later.
3. **Scale** — Client-side aggregation works at current scale but may need server-side optimization if student count exceeds 100+. Explicit out-of-scope for now.
