# Lessonly API Integration + API Key Security Hardening

## Overview

Integrate the Lessonly (Seismic Learning) API to automatically track completion status for LESSONLY-type training modules. Replace the manual check-off flow with real-time API-sourced status. Additionally, move the Gemini API key behind a Supabase Edge Function proxy to eliminate client-side exposure.

## Functional Requirements

### FR-1: Lessonly Edge Function Proxy
- Create `supabase/functions/lessonly-proxy/index.ts` Edge Function
- Accept `{ email: string, lessonIds: number[] }` as input
- Authenticate with Lessonly API via Basic Auth using server-side env vars (`LESSONLY_API_KEY`, `LESSONLY_SUBDOMAIN`)
- Call `GET /api/v1.1/users?filter[email]=<email>` to resolve Lessonly user ID
- Call `GET /api/v1.1/users/:id/assignments` to fetch all assignments
- Map `lessonIds` to assignment statuses and return `{ lessonly_user_found: boolean, statuses: Record<number, { status, completed_at }> }`
- Normalize email to lowercase before lookup

### FR-2: Lessonly Frontend Service
- Create `services/lessonlyService.ts`
- `parseLessonlyId(link: string): number | null` — extract lesson ID from URL pattern `lessonly.com/lesson/:id`
- `getLessonlyStatuses(email: string, lessonIds: number[]): Promise<LessonlyStatusResponse>` — invoke Edge Function via `supabase.functions.invoke()`

### FR-3: Lessonly Status Hook
- Create `hooks/useLessonlyStatus.ts`
- Accept user email + array of LESSONLY modules (with `link` fields)
- Parse lesson IDs from URLs, call service, return `Record<moduleId, { status, completedAt }>`
- Cache results per email within the session to avoid redundant API calls on tab switches

### FR-4: Manager Dashboard Status Badge Update
- In `components/ManagerDashboard.tsx`, update the training progress table
- For LESSONLY-type modules: use hook data instead of `m.completed`
- Display badges: "Complete" (green), "Pending" (gray), "Not Enrolled" (amber)

### FR-5: Write-Through to user_modules
- When Lessonly API returns "Completed" for a module, update `user_modules.completed = true` and `completed_at` in Supabase
- This ensures admin dashboard, new hire dashboard, and stats all reflect Lessonly completions without extra API calls

### FR-6: Gemini Edge Function Proxy
- Create `supabase/functions/gemini-proxy/index.ts` Edge Function
- Accept prompt/context payloads, call Gemini API with server-side `GEMINI_API_KEY`
- Return AI response

### FR-7: Gemini Service Refactor
- Refactor `services/geminiService.ts` to call `gemini-proxy` Edge Function instead of direct SDK
- Remove `process.env.GEMINI_API_KEY` / `import.meta.env.VITE_GEMINI_API_KEY` references
- Maintain same public interface (analyzeProgress, generateEmailDraft, generateManagerNotification)

## Non-Functional Requirements

- API keys must never appear in client-side JavaScript bundles
- Lessonly API failures must not break the UI — fall back to cached DB values
- Edge Functions follow the existing `slack-proxy` pattern

## Acceptance Criteria

- [ ] LESSONLY modules in cohort user card show status sourced from Lessonly API
- [ ] Completing a lesson in Lessonly → status updates in Flight School on next page load (no manual action)
- [ ] User not found in Lessonly → "Not Enrolled" badge displayed
- [ ] Lessonly API down → falls back to `user_modules.completed` from DB
- [ ] Non-LESSONLY modules unaffected — continue manual completion flow
- [ ] Gemini AI features work via Edge Function proxy (no client-side API key)
- [ ] `VITE_GEMINI_API_KEY` / `process.env.GEMINI_API_KEY` removed from codebase

## Out of Scope

- Background sync/cron for Lessonly status
- Syncing Lessonly scores
- Auto-assigning Lessonly content from Flight School
- Lessonly integration for new hire dashboard view (write-through partially covers this)
