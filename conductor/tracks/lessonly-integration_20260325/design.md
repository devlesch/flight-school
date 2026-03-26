---
track_id: lessonly-integration_20260325
created: 2026-03-25T20:00:00Z
status: approved
---

# Lessonly API Integration + API Key Security Hardening

## Problem Statement
We are solving inaccurate training completion tracking for Lessonly modules for managers viewing cohort member progress because the current system relies on manual check-off, creating a gap between actual completion in Lessonly and what Flight School shows. Additionally, the Gemini API key is exposed client-side and needs to be moved server-side.

## Success Criteria
- [ ] LESSONLY-type modules in cohort user card show real completion status from Lessonly API
- [ ] Status updates automatically — no manual user action needed for LESSONLY modules
- [ ] All API keys stay server-side via Edge Function proxies (Lessonly + Gemini)
- [ ] Non-LESSONLY modules continue to work as before (manual completion)
- [ ] Graceful fallback when Lessonly API is unavailable or user not found

## Out of Scope
- Background sync/cron (start with on-demand)
- Syncing Lessonly scores (just completion status)
- Auto-assigning Lessonly content from Flight School
- Lessonly integration for new hire dashboard (can be added later — write-through to user_modules will partially cover this)

## Chosen Approach
Edge Function proxy + on-demand fetch (Option A). Mirrors the existing `slack-proxy` pattern. Simple, no stale data, no DB migration needed.

## Design

### Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  ManagerDashboard    │────>│  lessonly-proxy       │────>│  Lessonly API    │
│  (cohort user card)  │     │  Edge Function        │     │  v1.1           │
│                      │<────│  Basic Auth           │<────│                 │
└─────────────────────┘     └──────────────────────┘     └─────────────────┘

┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  geminiService.ts    │────>│  gemini-proxy         │────>│  Gemini API     │
│  (all AI features)   │     │  Edge Function        │     │                 │
│                      │<────│  Server-side key      │<────│                 │
└─────────────────────┘     └──────────────────────┘     └─────────────────┘
```

### Lesson ID Mapping — No Migration Needed

LESSONLY modules already have a `link` field containing the Lessonly URL (e.g., `https://app.lessonly.com/lesson/123`). The lesson ID is parsed directly from the URL path — no new `lessonly_lesson_id` column or admin form field needed.

```typescript
// Parse lesson ID from existing link field
function parseLessonlyId(link: string): number | null {
  const match = link.match(/lessonly\.com\/lesson\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
```

### Components

**Part 1: Lessonly Integration**

1. **`supabase/functions/lessonly-proxy/index.ts`** — Edge Function
   - Accepts: `{ email: string, lessonIds: number[] }`
   - Calls Lessonly API: `GET /users?filter[email]=...` → get user ID
   - Then: `GET /users/:id/assignments` → get all assignments
   - Maps lessonIds to assignment statuses
   - Returns: `{ lessonly_user_found: boolean, statuses: Record<number, { status, completed_at }> }`
   - Auth: `Deno.env.get('LESSONLY_API_KEY')` + `Deno.env.get('LESSONLY_SUBDOMAIN')`

2. **`services/lessonlyService.ts`** — Frontend service
   - `parseLessonlyId(link)` — extracts lesson ID from URL
   - `getLessonlyStatuses(email, lessonIds)` — calls Edge Function via Supabase `functions.invoke()`
   - Returns mapped completion data

3. **`hooks/useLessonlyStatus.ts`** — React hook
   - Takes user email + LESSONLY modules array (with their `link` fields)
   - Parses lesson IDs from URLs, calls service
   - Returns `Record<moduleId, { status, completedAt }>`
   - Caches results per email to avoid re-fetching on tab switches within modal

4. **`components/ManagerDashboard.tsx`** — Status badge update
   - LESSONLY modules: use hook data instead of `m.completed`
   - Shows "Complete" (green) / "Pending" (gray) / "Not Enrolled" (amber)

5. **Write-through:** When Lessonly returns "Completed", update `user_modules.completed = true` + `completed_at` so other views (admin stats, new hire dashboard) also reflect it without extra API calls.

**Part 2: Gemini API Key Hardening**

6. **`supabase/functions/gemini-proxy/index.ts`** — Edge Function
   - Accepts: `{ prompt: string, context?: string }`
   - Calls Gemini API with `Deno.env.get('GEMINI_API_KEY')`
   - Returns AI response

7. **`services/geminiService.ts`** — Refactor
   - Replace direct Gemini SDK calls with `supabase.functions.invoke('gemini-proxy', ...)`
   - Remove `process.env.GEMINI_API_KEY` / `import.meta.env.VITE_GEMINI_API_KEY` references
   - Keep the same public interface (analyzeProgress, generateEmailDraft, etc.)

### Data Model

No migration needed. Lesson IDs parsed from existing `training_modules.link` field.

```typescript
// Lessonly proxy response
interface LessonlyStatusResponse {
  lessonly_user_found: boolean;
  statuses: Record<number, {
    status: 'Completed' | 'Incomplete' | 'not_found';
    completed_at: string | null;
  }>;
}
```

### User Flow

1. Admin creates LESSONLY module with link `https://app.lessonly.com/lesson/123` (existing flow, no change)
2. Manager opens cohort page, clicks user card
3. Modal opens, training progress table renders
4. Hook detects LESSONLY modules, parses lesson IDs from their `link` fields
5. Calls `lessonly-proxy` Edge Function with user email + parsed lesson IDs
6. Edge Function: finds Lessonly user by email → fetches their assignments → maps statuses
7. Component updates badges for LESSONLY modules
8. Write-through: completed modules get `user_modules.completed = true` written to DB

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Edge Function unreachable | Fall back to `user_modules.completed` from DB |
| User not in Lessonly | Show "Not Enrolled" badge (amber) |
| Lesson not in user's assignments | Show "Not Assigned" badge |
| URL doesn't contain valid lesson ID | Fall back to manual completion flow |
| API rate limit / timeout | Return fallback, log warning |
| Invalid API credentials | Log error, fall back to DB values |

### Testing Strategy

- Unit: `lessonlyService.ts` — mock Edge Function responses, test URL parsing
- Unit: `useLessonlyStatus` hook — loading/error/success states
- Unit: `geminiService.ts` — verify proxy calls replace direct SDK calls
- Component: ManagerDashboard renders correct badge per Lessonly status

## Grounding Notes
- `slack-proxy` Edge Function exists at `supabase/functions/slack-proxy/index.ts` — pattern reference
- LESSONLY exists in `ModuleType` enum (`types/database.ts` line 17)
- Existing test data uses `https://app.lessonly.com/lesson/123` URL format
- Status badge logic at `ManagerDashboard.tsx` line ~933 — simple `m.completed` ternary
- `getCohortMembersForManager()` in `cohortService.ts` builds the data pipeline
- Gemini currently uses `process.env.GEMINI_API_KEY` in `geminiService.ts` line 10

## Party Panel Insights
- Winston: Write-through to `user_modules` ensures all views benefit from Lessonly data
- Backend Architect: Batch Lessonly API calls (1 user lookup + 1 assignments call per user)
- Reality Checker: Design Edge Function interface cleanly for potential background sync upgrade later

## Risks & Open Questions
- Lessonly API rate limits not documented — monitor usage
- Email case sensitivity in Lessonly user lookup — normalize to lowercase
- Lessonly URL format may vary (paths, learning paths) — parser should handle variants
