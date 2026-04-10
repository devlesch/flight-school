---
track_id: lessonly-scores_20260410
created: 2026-04-10T07:00:00Z
status: approved
---

# Lessonly Score Capture and Display

## Problem Statement
Lessonly provides quiz scores via both the API and webhook, but the entire pipeline discards them. The `user_modules.score` field exists but stays null.

## Success Criteria
- [ ] Lessonly proxy returns score in response
- [ ] Webhook captures score_percent and saves to user_modules.score
- [ ] Webhook updates score even on re-completions (retakes)
- [ ] On-modal-open sync passes score when updating
- [ ] Score displayed in training progress table (manager + admin cohort drilldown)
- [ ] Null score (no quiz) shows nothing — no broken UI

## Out of Scope
- Score display in student/new hire view
- Score-based analytics or pass/fail logic

## Changes (7 files)

1. **lessonly-proxy** — return `score` in response mapping
2. **lessonly-webhook** — extract `score_percent`, save to DB, update score on retakes
3. **lessonlyService.ts** — add `score` to `LessonlyStatus` interface
4. **lessonlySyncService.ts** — pass score when updating completion
5. **cohortService.ts** — add `score` to `UserModuleWithDetails`, map in builder
6. **ManagerDashboard.tsx** — map score in myHires, display in training table
7. **AdminDashboard.tsx** — map score in inline drilldown, display in training table

## Key Edge Case
Webhook returns early when `existing?.completed` is true (already done). Must still update score — student may have retaken the lesson with a new score.
