# Implementation Plan: lessonly-integration_20260325

## Phase 1: Lessonly Edge Function Proxy

- [x] Task 1.1: Create `supabase/functions/lessonly-proxy/index.ts`
  - [x] Set up Deno Edge Function scaffold (CORS headers, request parsing)
  - [x] Read `LESSONLY_API_KEY` and `LESSONLY_SUBDOMAIN` from `Deno.env.get()`
  - [x] Implement Basic Auth call to `GET /api/v1.1/users?filter[email]=<email>`
  - [x] Implement call to `GET /api/v1.1/users/:id/assignments`
  - [x] Map lessonIds to assignment statuses, return response
  - [x] Handle errors: user not found, API timeout, invalid credentials
- [x] Task 1.2: Write unit tests for lessonly-proxy
  - [x] Test successful status fetch (user found, lessons matched)
  - [x] Test user not found in Lessonly
  - [x] Test lesson ID not in assignments
  - [x] Test API error / timeout handling
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Lessonly Frontend Service + Hook

- [x] Task 2.1: Create `services/lessonlyService.ts`
  - [x] Implement `parseLessonlyId(link)` — regex extract from URL
  - [x] Implement `getLessonlyStatuses(email, lessonIds)` — call Edge Function via `supabase.functions.invoke()`
  - [x] Define `LessonlyStatusResponse` interface
- [x] Task 2.2: Write tests for lessonlyService
  - [x] Test `parseLessonlyId` with valid URLs, invalid URLs, edge cases
  - [x] Test `getLessonlyStatuses` with mocked Edge Function responses
- [x] Task 2.3: Create `hooks/useLessonlyStatus.ts`
  - [x] Accept user email + LESSONLY modules array
  - [x] Parse lesson IDs from module `link` fields
  - [x] Call service, manage loading/error/data states
  - [x] Cache results per email to avoid re-fetching on tab switches
- [x] Task 2.4: Write tests for useLessonlyStatus hook
  - [x] Test loading state
  - [x] Test successful data return
  - [x] Test error fallback
  - [x] Test caching behavior
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Manager Dashboard Integration

- [x] Task 3.1: Update `components/ManagerDashboard.tsx` status badge
  - [x] Import and call `useLessonlyStatus` hook when viewing a hire
  - [x] For LESSONLY modules: replace `m.completed` ternary with hook-sourced status
  - [x] Render "Complete" (green), "Pending" (gray), "Not Enrolled" (amber) badges
  - [x] Show loading indicator while Lessonly data is fetching
- [x] Task 3.2: Implement write-through to user_modules
  - [x] When hook returns "Completed" for a module, call `updateModuleProgress()` to set `completed = true` and `completed_at`
  - [x] Skip write if already marked completed in DB
- [ ] Task 3.3: Write component tests
  - [ ] Test LESSONLY module renders API-sourced status
  - [ ] Test non-LESSONLY module still uses `m.completed`
  - [ ] Test fallback when Lessonly API fails
  - [ ] Test "Not Enrolled" badge rendering
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Gemini Edge Function Proxy

- [ ] Task 4.1: Create `supabase/functions/gemini-proxy/index.ts`
  - [ ] Set up Deno Edge Function scaffold
  - [ ] Read `GEMINI_API_KEY` from `Deno.env.get()`
  - [ ] Accept prompt/context payloads, call Gemini API
  - [ ] Return AI response
  - [ ] Handle errors: missing key, API failures, rate limits
- [ ] Task 4.2: Write tests for gemini-proxy
  - [ ] Test successful AI response
  - [ ] Test missing API key handling
  - [ ] Test API error handling
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

## Phase 5: Gemini Service Refactor

- [ ] Task 5.1: Refactor `services/geminiService.ts`
  - [ ] Replace direct `@google/genai` SDK calls with `supabase.functions.invoke('gemini-proxy', ...)`
  - [ ] Remove `process.env.GEMINI_API_KEY` / `import.meta.env.VITE_GEMINI_API_KEY` references
  - [ ] Maintain same public interface: `analyzeProgress()`, `generateEmailDraft()`, `generateManagerNotification()`
- [ ] Task 5.2: Update tests for geminiService
  - [ ] Mock Edge Function calls instead of direct SDK
  - [ ] Verify all public functions work through proxy
- [ ] Task 5.3: Clean up — remove `@google/genai` from package.json if no longer needed
- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)
