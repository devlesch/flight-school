---
track_id: import-new-fields_20260426
status: planned
created: 2026-04-27
phases: 4
---

# Implementation Plan: Bulk User Import — CSV Support, New Fields, and Hardening

Per `conductor/workflow.md`: TDD (Red → Green → Refactor), commit-per-task, ≥80% coverage, Phase Completion Verification at every phase boundary.

Status markers:
- `[ ]` Pending
- `[~]` In progress
- `[x]` Completed (followed by 7-char commit SHA)

---

## Phase 1: Pure Mapper Module

**Goal:** Stand up `services/userImportMappers.ts` with all pure helper functions, fully unit-tested. No coupling to the existing import service yet — this is the foundation.

**Spec coverage:** FR-3, FR-4, FR-5 (parts), FR-7 (gate). NFR-2.

### Tasks

- [x] **1.1 Test:** Create `tests/unit/userImportMappers.test.ts` with skeleton + describe blocks for: `parseRegionColumn`, `inferRegionFromLocation`, `inferRegionFromState`, `inferStandardizedRole`, `normalizeEmail`, `isValidEmail`, `isAllowedDomain`, `dedupeByEmail`, `findManagerByName`, `shouldUpdateField`.

- [x] **1.2 Test:** Fill in `parseRegionColumn` cases — `"US East"` → East, `"US West"` → West, `"US Central"` → Central, `"CAN East"` → East, `"CAN West"` → West (defensive), lowercase variants, `"Florida"` → null, `"Ohio"` → null, null/empty/whitespace.

- [x] **1.3 Test:** Fill in `inferRegionFromLocation` cases — including critical regression test `inferRegionFromLocation("Seattle - 2033 6th Ave")` → West.

- [x] **1.4 Test:** Fill in `inferRegionFromState` cases — `"Washington"` → West (NOT East); `"New York"` → East; `"Ontario"` → East; case-insensitive; trim; unknown state → null; null/empty.

- [x] **1.5 Test:** Fill in `inferStandardizedRole` cases — each enum role; AGM-vs-GM specificity; prefix variants; non-MX → null.

- [x] **1.6 Test:** Fill in `normalizeEmail`, `isValidEmail`, `isAllowedDomain` cases — lowercase, trim, idempotency, null-safety, positive/negative cases.

- [x] **1.7 Test:** Fill in `dedupeByEmail` cases — last-wins; sourceRow/keptSourceRow tracking; empty-input edge case; all-duplicate edge case.

- [x] **1.8 Test:** Fill in `findManagerByName` cases — 0/1/2+ matches; case-insensitive; trim; **self-reference exclusion** with `selfEmail`.

- [x] **1.9 Test:** Fill in `shouldUpdateField` cases — all gate semantics covered including null/empty rejection.

- [x] **1.10 Implement:** Created `services/userImportMappers.ts` with all exports per design.md.

- [x] **1.11 Verify:** `npx vitest run tests/unit/userImportMappers.test.ts` → 61/61 tests pass. `npx tsc --noEmit -p .` → no TypeScript errors on new files. Project's `vitest.config.ts` excludes `services/**` from coverage instrumentation (pre-existing config); test density (61 cases over 11 functions, all branches exercised) confirms ≥80% coverage qualitatively.

- [x] **1.12 Commit:** `feat(import): add userImportMappers pure-function module` (413e9c0). Track planning artifacts committed in 55bb8be.

- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Pure Mapper Module' (Protocol in workflow.md)**

---

## Phase 2: Hardened Import Service

**Goal:** Heavy modification of `services/workdayImportService.ts` — CSV parsing, extended column patterns, `sourceRowIndex` propagation, pre-flight pass, two-prefetch strategy, name-based manager linkage, chunked parallel writes, expanded `ImportResult`. Filename preserved.

**Spec coverage:** FR-1, FR-2, FR-5, FR-6, FR-8, FR-9, FR-10, FR-11, FR-14. NFR-1, NFR-2, NFR-4, NFR-5.

### Tasks

- [ ] **2.1 Fixture:** Create `tests/fixtures/sample-workday.csv` — sanitized version of the real Employee Roster (names → `User N`, emails → `user.N@industriousoffice.com`). Include: row-3 header, BOM, embedded-comma quoted titles, `US East` / `US West` / `US Central` / `CAN East` rows, state-named region rows (NY, FL, OH, PA), name-only Manager column with one duplicate-name pair, mixed date formats (4-digit and 2-digit year), at least one unicode name.

- [ ] **2.2 Fixture:** Create `tests/fixtures/sample-workday.xlsx` — XLSX mirror of the CSV fixture for parity tests. (Generate via xlsx CLI or hand-build a minimal sheet.)

- [ ] **2.3 Test:** Create `tests/unit/userImportService.test.ts` skeleton with all describe/it.todo entries from the test plan in `design.md` § Testing Strategy.

- [ ] **2.4 Test:** Fill in `parseUserImport` parsing cases — CSV BOM stripped; quoted fields with embedded commas; CRLF; row-3 header detection; XLSX parity. Each row carries `sourceRowIndex` matching its 1-based position (header counted).

- [ ] **2.5 Test:** Fill in `parseUserImport` derivation cases — `region` via column / location / state cascade; `regionSource` reflects winner; `standardizedRole` populated for MX titles, null for others.

- [ ] **2.6 Test:** Fill in `parseUserImport` extended-column cases — bare `Title` detected; `Region` detected; `HUB Location` preferred over `Location`; `State/Province` detected; `Legal Name - First Name` detected.

- [ ] **2.7 Test:** Fill in `parseUserImport` date-format cases — `4/20/2026` and `5/21/18` both produce valid ISO dates (V8-only assertion).

- [ ] **2.8 Test:** Fill in `importUsers` pre-flight cases — drops wrong-domain (no insert); drops invalid emails (no insert); dedupes within batch (later occurrence kept; `duplicatesInBatch` carries `sourceRow` and `keptSourceRow`).

- [ ] **2.9 Test:** Fill in `importUsers` prefetch cases — 250-email batch issues 2 chunked prefetch queries (200 + 50) merged via `Promise.all`; name-based manager lookup uses `select('id, name, email')` of ALL profiles (test: a manager exists in DB but is NOT in batch — still resolved).

- [ ] **2.10 Test:** Fill in `importUsers` insert cases — new profile gets all fields including region + standardized_role; new manager profile (email present, no batch row of their own) gets NULL region/std_role (asserts the documented limitation).

- [ ] **2.11 Test:** Fill in `importUsers` self-reference cases — email path (`managerEmail == workerEmail` → `selfReferenceManager` with `via: 'email'`, no manager profile created/upgraded for that email); name path (manager name matches own profile → `findManagerByName` filters self out, entry added with `via: 'name'`).

- [ ] **2.12 Test:** Fill in `importUsers` manager-linkage cases — name-only match (1 hit) → linked; 0 hits → `unmappedManager`; 2+ hits → `ambiguousManager` (fixture deliberately includes two profiles with same name).

- [ ] **2.13 Test:** Fill in `importUsers` state-fallback case — row with Region=null, HUB="Remote - OH", State="Ohio" → `inferRegionFromState` resolves to Central. End-to-end through `parseUserImport` + `importUsers`.

- [ ] **2.14 Test:** Fill in `importUsers` update-gating cases — provisioned profile gets updates; non-provisioned with null existing gets fill-in; non-provisioned with non-null existing left alone; empty new value never overwrites existing non-null (cannot-clear-via-import limitation).

- [ ] **2.15 Test:** Fill in `importUsers` idempotency cases — re-importing identical data → 0 inserts, 0 updates, all in `skipped`. Cross-format idempotency: yesterday's import filled region via inference; today's same data with explicit Region column produces no update.

- [ ] **2.16 Test:** Fill in `importUsers` chunking + failure cases — 250-row batch issues 3 insert chunks (100/100/50); uses `Promise.all` (NOT `allSettled`); chunk error → retried once → on failure rows added to `failedRows` with correct `sourceRow`; other chunks succeed.

- [ ] **2.17 Test:** Fill in `importUsers` counter-invariant cases — `regionFromColumn + regionFromInference + regionUnmapped === processedRows`; `standardizedRolePopulated + standardizedRoleNotApplicable === processedRows`; `regionPopulated === regionFromColumn + regionFromInference`.

- [ ] **2.18 Implement:** Add new types to `services/workdayImportService.ts` — `ParsedImport`, `UserImportRow` (with `sourceRowIndex`, `hubLocation`, `stateProvince`, `rawRegion`, `region`, `regionSource`, `standardizedRole`), expanded `ImportResult` with all new counters and buckets.

- [ ] **2.19 Implement:** Extend `COLUMN_PATTERNS` with new entries (`title` bare, `region`, `hub location`/`hub`, `state/province`/`state`/`province`, `legal name - first name`/`preferred name - first name`/`legal name - last name`). Reorder so HUB Location is matched before Location.

- [ ] **2.20 Implement:** Refactor `parseWorkdayExcel` → `parseUserImport` accepting both CSV and XLSX. Detect format by extension + content sniff. Strip BOM for CSV. Use existing `xlsx` lib for both formats. Keep existing dimension-fix logic for XLSX. Preserve existing header auto-detection (extended patterns). Build `UserImportRow` with `sourceRowIndex` (1-based, header counted). Apply mappers per row to compute `region`/`regionSource`/`standardizedRole`. Return `ParsedImport`. Add re-export `parseWorkdayExcel = parseUserImport` for any external callers.

- [ ] **2.21 Implement:** Refactor `importWorkdayData` → `importUsers(parsed: ParsedImport)`. Add re-export for backwards compat. Implement pre-flight: normalize emails, drop invalid → `invalidEmail[]`, drop wrong-domain → `wrongDomain[]`, dedupe via `dedupeByEmail` → `duplicatesInBatch[]`. Compute `processedRows`.

- [ ] **2.22 Implement:** Two-prefetch query strategy. Email prefetch chunked at 200 + Promise.all-merged → `existingByEmail`. Directory prefetch `select('id, name, email').not('name', 'is', null)` → `allProfilesByName`.

- [ ] **2.23 Implement:** Pass 2 (managers). Self-reference guard for both paths. Existing email-keyed flow preserved (with `shouldUpdateField` gate for role / region / standardized_role / title on existing managers). Chunked Promise.all writes. Increment `managersCreated`, `managersUpgraded`.

- [ ] **2.24 Implement:** Pass 3 (workers). For each worker, resolve `manager_id`: by email (re-using existingByEmail, post-Pass-2), or by name via `findManagerByName(managerName, allProfilesByName, selfEmail=workerEmail)`. Self-reference paths add to `selfReferenceManager`. Unresolved paths add to `unmappedManager` / `ambiguousManager`. Increment `managersLinked` on successful link.

- [ ] **2.25 Implement:** Pass 3 partition (needsInsert / needsUpdate / noop). Inserts always set region + standardized_role + all fields from row. Updates use `shouldUpdateField` gate per field (region, standardized_role, manager_id, title, department, start_date, location). Chunked Promise.all (chunks of 100) with single retry on failure → failedRows on second failure.

- [ ] **2.26 Implement:** Counter accumulation. Region counters update as `regionFromColumn` / `regionFromInference` / `regionUnmapped` based on `row.regionSource`. Role counters update as `standardizedRolePopulated` / `standardizedRoleNotApplicable`. `created` / `updated` / `skipped` driven by Pass 3 partition outcome.

- [ ] **2.27 Verify:** Run `npm test -- userImportService` — all tests green. Run `npm run test:coverage -- workdayImportService userImportMappers` — ≥80% line coverage on both files.

- [ ] **2.28 Verify:** TypeScript check — `npx tsc --noEmit` — no new errors.

- [ ] **2.29 Verify:** Performance smoke test — generate a 1,000-row synthetic CSV (e.g. via a one-off node script in `/tmp`), run `parseUserImport` + `importUsers` against a local Supabase test instance, confirm wall-clock ≤15s. Document the timing in the verification meta-task.

- [ ] **2.30 Commit:** `feat(import): harden user import — CSV, region/std_role, pre-flight, name-linkage`. May split into 2-3 atomic commits if the diff is large (parsing + result types as one commit; pre-flight + prefetch as another; passes 2-3 as a third).

- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Hardened Import Service' (Protocol in workflow.md)**

---

## Phase 3: AdminDashboard UI Integration

**Goal:** Light modification of `components/AdminDashboard.tsx` — accept CSV files, render the expanded result panel, ship the Download Diagnostics CSV feature.

**Spec coverage:** FR-1 (UI side), FR-12, FR-13.

### Tasks

- [ ] **3.1 Implement:** File input — change `accept=".xlsx,.xls"` to `accept=".csv,.xlsx,.xls"` (line ~847). Update extension validation in `handleFileUpload` (line ~493) to permit `csv`.

- [ ] **3.2 Implement:** Result panel — replace existing 4-tile grid (Created/Updated/Skipped/Managers, ~lines 854-859) with a 4×3 grid of 12 tiles per the spec. Reuse existing card classes for visual consistency. Region Populated tile shows subtext `"X from column · Y inferred"` below the headline number.

- [ ] **3.3 Implement:** Manager-linkage row below the grid: `"Manager linkage: ${managersLinked} linked, ${unmappedManager.length} unresolved, ${ambiguousManager.length} ambiguous, ${selfReferenceManager.length} self-reference"`. Use existing typography classes.

- [ ] **3.4 Implement:** "Download diagnostics CSV" button. Visible only when any of `invalidEmail | wrongDomain | duplicatesInBatch | unmappedManager | ambiguousManager | selfReferenceManager | failedRows` is non-empty. On click: assemble a CSV string with columns `source_row, email, name, bucket, reason, raw_value`, build per-bucket reason strings per the spec FR-13 mapping, trigger download via `Blob` + anchor with filename `flight-school-import-diagnostics-${YYYY-MM-DD}.csv`. Reuse `bg-[#FDD344] text-[#013E3F]` CTA styling.

- [ ] **3.5 Implement:** `details[]` rendering — cap at first 50 entries; if more, append `"…and ${N - 50} more (see diagnostics CSV)"` line. Replaces the current cap-at-20 logic (line ~872).

- [ ] **3.6 Implement:** Update success-panel copy on the file-upload card if needed for clarity (e.g. "Workday Automation" header is fine; no copy change required unless ambiguity introduced by the new behavior).

- [ ] **3.7 Verify:** Manual smoke test — start dev server (`npm run dev`), log in as Admin, navigate to Workflow → Workday Import. Upload the real `Employee_Roster_(Active)_-_Unit_Ops` CSV. Confirm: file picker accepts CSV; spinner runs; result panel shows all 12 tiles populated with sensible numbers; manager-linkage row shows non-zero linked count; Download Diagnostics CSV produces a valid CSV when failure buckets non-empty; confetti fires on success.

- [ ] **3.8 Verify:** Visual regression check — confirm existing AdminDashboard tabs (Team Registry, New Team Member) still render correctly; no styling regressions in the import success card or info card.

- [ ] **3.9 Commit:** `feat(import): expand admin dashboard import result panel with diagnostics CSV`.

- [ ] **Task: Conductor - User Manual Verification 'Phase 3: AdminDashboard UI Integration' (Protocol in workflow.md)**

---

## Phase 4: End-to-End Verification & Cleanup

**Goal:** Confirm the full system meets all acceptance criteria. No new code; just rigorous verification, edge-case probing, and final cleanup.

**Spec coverage:** All Acceptance Criteria. NFR-1, NFR-2, NFR-3, NFR-5.

### Tasks

- [ ] **4.1 Verify:** Run the full test suite — `npm test`. All tests pass. Capture the run output for the verification record.

- [ ] **4.2 Verify:** Run coverage — `npm run test:coverage`. Confirm ≥80% on both new/modified import files. No regression on previously-covered files.

- [ ] **4.3 Verify:** TypeScript build — `npm run build`. No new errors or warnings.

- [ ] **4.4 Verify:** Acceptance Criterion 1 (region coverage on real file) — import the sanitized fixture (or the real Employee Roster against a dev DB), inspect `ImportResult`, confirm `regionPopulated / processedRows ≥ 0.99`.

- [ ] **4.5 Verify:** Acceptance Criterion 2 (wrong-domain rejection) — construct a 3-row fixture with one wrong-domain row, import, confirm rejection bucket entry and absence of DB insert for that row.

- [ ] **4.6 Verify:** Acceptance Criterion 3 (within-batch dedup) — construct a 2-row fixture with duplicate emails, import, confirm one survives and one lands in `duplicatesInBatch[]`.

- [ ] **4.7 Verify:** Acceptance Criterion 4 (manager linkage by name) — using fixture with name-only Manager column, confirm `managersLinked` count = unique manager names − unresolved − ambiguous − self-reference.

- [ ] **4.8 Verify:** Acceptance Criterion 5 (idempotency) — re-import any successfully-imported file, confirm `created == 0 && updated == 0 && skipped == processedRows`.

- [ ] **4.9 Verify:** Acceptance Criterion 6 (admin override preservation) — manually flip a profile's `standardized_role` and `provisioned=false` via SQL or Team Registry, then re-import a file that maps them differently, confirm the manual value persists.

- [ ] **4.10 Verify:** Acceptance Criterion 7 (UI render) — visual confirmation that all 12 tiles render plus manager-linkage row; Download Diagnostics CSV produces valid output.

- [ ] **4.11 Verify:** Acceptance Criterion 8 (self-reference detection, email path) — import a fixture row where `managerEmail == workerEmail`, confirm `selfReferenceManager[]` entry with `via: 'email'`, confirm worker's `manager_id` is null in DB, confirm no manager profile created or upgraded for that email.

- [ ] **4.12 Verify:** Acceptance Criterion 10 (performance) — 1,000-row synthetic import ≤15s. Document the timing.

- [ ] **4.13 Cleanup:** Remove the temporary real-data CSV from the repo root (`Employee_Roster_(Active)_-_Unit_Ops (2).xlsx - Sheet1.csv`) — it was only used for design grounding; replace with the sanitized fixture in `tests/fixtures/`.

- [ ] **4.14 Cleanup:** Re-read the diff for any `console.log`, `// TODO`, or other accidentally-left development noise. Remove.

- [ ] **4.15 Final commit:** `chore(import): finalize import hardening track` (only if cleanup yielded changes; otherwise skip).

- [ ] **Task: Conductor - User Manual Verification 'Phase 4: End-to-End Verification & Cleanup' (Protocol in workflow.md)**

---

## Notes for the Implementer

- **Code samples in `design.md` § Data Model are authoritative** for the mapper module's exported API (function signatures, return types, table contents). Diverge only with explicit reason.
- **Keep filename `services/workdayImportService.ts`** even though the module is now generic. Renaming would explode the cross-file diff for this PR.
- **Use `Promise.all`, NOT `Promise.allSettled`** for chunk dispatch — per-row attribution within a partially-failed chunk is out of scope.
- **Watch for scope drift.** Anything in the design's "Out of Scope" or "Open Questions" list belongs in a follow-up track, not here.
- **The real Employee Roster CSV (in repo root) is sensitive PII** — sanitize before committing as a fixture; remove the original from the repo in Phase 4.
- **Date parsing** — the existing `parseDateCell` uses `new Date(s)`. Don't replace it unless a test fails; the V8-only constraint is documented and accepted.
