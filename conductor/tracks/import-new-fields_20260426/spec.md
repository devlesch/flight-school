---
track_id: import-new-fields_20260426
type: feature
status: planned
created: 2026-04-26
spec_finalized: 2026-04-27
---

# Spec: Bulk User Import — CSV Support, New Fields, and Hardening

## Overview

The Admin Dashboard's bulk user import (Workday Import tab in `components/AdminDashboard.tsx`, backed by `services/workdayImportService.ts`) has multiple compounding correctness, robustness, and completeness defects. This track delivers a comprehensive hardening:

- **Format coverage**: accept CSV files (UI advertises but functionality rejects them today).
- **Field coverage**: populate `region` and `standardized_role` on `profiles` — both load-bearing for cohort matching (`cohortService.ts:320`) and leadership lookup (`useLeadershipTeam`).
- **Validation**: pre-flight pass to reject invalid emails, wrong-domain emails, and within-batch duplicates *before* any DB write.
- **Manager linkage**: support files where the Manager column has names only (no email column) via case-insensitive name lookup against the full profile directory.
- **Admin-override protection**: never overwrite manually-curated values on non-provisioned profiles.
- **Performance**: chunked parallel writes for ~10× throughput improvement.
- **Diagnostics**: comprehensive per-row outcome telemetry plus a downloadable diagnostics CSV.

The full architectural treatment is in `design.md`; this spec lists the functional and non-functional requirements that bind the implementation.

## Functional Requirements

### FR-1: CSV file format support
- File picker on the Workday Import tab MUST accept `.csv` in addition to `.xlsx` and `.xls`.
- `handleFileUpload` extension validation MUST permit `.csv`.
- CSV parsing MUST handle: UTF-8 with optional BOM; RFC-4180 quoted fields with embedded commas, quotes, and newlines; mixed line endings (CRLF/LF).
- Existing `.xlsx` and `.xls` flows MUST remain unchanged — no regression.

### FR-2: Column auto-detection — extended patterns
The header auto-detector MUST recognize all of:
- Bare `Title` (in addition to `Business Title`, `Job Title`, `Job Profile`, `Position Title`).
- `Region` as a distinct column.
- `HUB Location` and bare `HUB` (preferred over `Location` for region inference).
- `Work Address - State/Province`, bare `State`, and `Province`.
- `Legal Name - First Name` / `Preferred Name - First Name` / `Legal Name - Last Name` (Workday-style headers).

Existing Workday-style headers MUST still resolve correctly (backwards compatibility).

### FR-3: Region resolution cascade
For each row, region resolution MUST run in this order:
1. `parseRegionColumn(rawRegion)` — strips country prefix (`US `, `CAN `, etc.), validates against `{East, Central, West}`. Canada (`CAN East`) maps to `East` per product decision.
2. If null, `inferRegionFromLocation(hubLocation || location)` — keyword match against `LOCATION_REGION_MAP`.
3. If still null, `inferRegionFromState(stateProvince)` — exact match against `STATE_REGION_MAP`.
4. Otherwise null.

The `Washington` keyword MUST NOT appear in `LOCATION_REGION_MAP` (avoid Washington-state-vs-DC ambiguity); the state path uses `STATE_REGION_MAP` where `Washington` correctly maps to West.

`regionSource` (`'column' | 'inferred' | null`) MUST be tracked per row for telemetry.

### FR-4: Standardized role inference
`inferStandardizedRole(businessTitle)` MUST achieve 100% recall on its five target keywords (case-insensitive substring match, longest-pattern-first ordering):
- `Regional Director` → `RD`
- `Assistant General Manager` → `AGM`
- `General Manager` → `GM`
- `Member Experience Manager` → `MxM`
- `Member Experience Associate` → `MxA`

Non-MX titles correctly remain `null` (this is success, not failure).

### FR-5: Email normalization and validation (pre-flight)
Before any DB write, every row's email MUST be:
1. Lowercased and trimmed (`normalizeEmail`).
2. Validated as well-formed (`isValidEmail`). Failures → `invalidEmail[]` bucket.
3. Validated against `ALLOWED_EMAIL_DOMAINS` (currently `['industriousoffice.com']`). Failures → `wrongDomain[]` bucket.
4. Deduplicated within the batch (last-wins by source-file row order). Earlier occurrences → `duplicatesInBatch[]` bucket.

Rejected rows MUST NOT trigger any insert or update.

### FR-6: Manager linkage
Manager resolution MUST follow this priority:
1. **Self-reference guard** (both paths): if normalized `managerEmail == workerEmail` OR a name-lookup hit's email matches the worker's email, skip the link. Add to `selfReferenceManager[]` with `via: 'email' | 'name'`. `manager_id` stays null. No manager profile created/upgraded for that email.
2. **By email** (`managerEmail` present): existing email-keyed flow. Newly-created manager profiles (email present, no batch row of their own) get NULL `region` / `standardized_role` — explicit limitation.
3. **By name** (`managerName` only): `findManagerByName(managerName, allProfilesByName, selfEmail=workerEmail)` against the full profile directory (NOT just batch members).
   - 0 matches → `unmappedManager[]`.
   - 1 match → link `manager_id`.
   - 2+ matches → `ambiguousManager[]`.
   - In all unresolved cases, `manager_id` stays null. No new manager profile created from name-only data.

### FR-7: Admin-override-preserving update gate
`shouldUpdateField(existing, fieldName, newValue)` MUST return `true` only when ALL of:
- `newValue` is non-null and non-empty.
- `existing[fieldName] !== newValue`.
- Either `existing.provisioned === true` OR `existing[fieldName] == null`.

Applied to all auto-derived fields on the update path: `region`, `standardized_role`, `manager_id`, `title`, `department`, `start_date`, `location`. NOT applied to system `role` (system role is never auto-updated on the worker path; Pass 2 may upgrade to Manager via the gate).

### FR-8: Two-prefetch query strategy
Before any writes, the importer MUST issue exactly two prefetch queries in parallel:
1. `select('*').in('email', [batch_emails])` — chunked into groups of ≤200 emails (URL-length safety) and merged via `Promise.all`. Builds `existingByEmail` map.
2. `select('id, name, email').not('name', 'is', null)` — full profile directory used by `findManagerByName` (and self-reference detection). Builds `allProfilesByName` map.

### FR-9: Chunked parallel writes
Both Pass 2 (managers) and Pass 3 (workers) MUST batch insert/update operations in chunks of 100 rows, dispatched via `Promise.all` (NOT `Promise.allSettled`). On chunk failure: retry once; on second failure, every row in that chunk lands in `failedRows[]` with the chunk-level error reason. Other chunks are unaffected.

### FR-10: ImportResult — comprehensive diagnostics
`ImportResult` MUST expose all counters and buckets defined in `design.md` § Data Model:
- Outcome counts: `parsedRows`, `processedRows`, `created`, `updated`, `skipped`, `managersCreated`, `managersUpgraded`, `managersLinked`.
- Region telemetry: `regionPopulated`, `regionFromColumn`, `regionFromInference`, `regionUnmapped`. Invariant: `regionFromColumn + regionFromInference + regionUnmapped === processedRows`.
- Role telemetry: `standardizedRolePopulated`, `standardizedRoleNotApplicable`. Invariant: sum equals `processedRows`.
- Pre-flight rejection buckets: `invalidEmail[]`, `wrongDomain[]`, `duplicatesInBatch[]`. Each entry carries `sourceRow` (1-based, header-counted).
- Manager-linkage buckets: `unmappedManager[]`, `ambiguousManager[]`, `selfReferenceManager[]`.
- DB-failure: `errors[]`, `failedRows[]`.
- Free-form audit: `details[]`.

### FR-11: Source row tracking
Every row that survives parse MUST carry a `sourceRowIndex` (1-based, header row counted — matches what admins see when they open the file in Excel/Sheets). All diagnostic buckets MUST reference this index in their `sourceRow` field.

### FR-12: Result panel UI
The AdminDashboard import success panel MUST render:
- A 4×3 grid (12 tiles): Created, Updated, Skipped, Managers Created, Managers Upgraded, Region Populated (with subtext "X from column · Y inferred"), Region Unmapped, Role Populated, Role N/A (non-MX), Wrong Domain, Invalid Email, Within-Batch Duplicates.
- A manager-linkage row: "Manager linkage: X linked, Y unresolved, Z ambiguous, W self-reference".
- A "Download diagnostics CSV" button (when any failure/skip bucket non-empty).
- `details[]` rendering capped at the first 50 entries with a "…and N more (see diagnostics CSV)" tail.

### FR-13: Diagnostics CSV export
Clicking "Download diagnostics CSV" MUST generate a CSV named `flight-school-import-diagnostics-${YYYY-MM-DD}.csv` with columns: `source_row, email, name, bucket, reason, raw_value`. One row per entry across all rejection/failure buckets. Per-bucket reason mapping:
- `invalidEmail` → entry's `reason` field.
- `wrongDomain` → "non-allowed domain: {domain}".
- `duplicatesInBatch` → "duplicate of source_row {keptSourceRow}".
- `unmappedManager` → "manager name '{managerName}' not found in DB".
- `ambiguousManager` → "{matchCount} profiles match name '{managerName}'".
- `selfReferenceManager` → "self-reference (via {via})".
- `failedRows` → entry's `reason` field.

### FR-14: Idempotency
Re-uploading the same file MUST produce zero inserts and zero updates. Every row MUST land in `skipped`. Cross-format idempotency MUST also hold: a row whose region was previously filled via inference and is now provided by the Region column produces no update (same final value).

## Non-Functional Requirements

### NFR-1: Performance
A 1,000-row CSV MUST complete end-to-end in ≤15 seconds (down from ~60s today). Verified via informal manual timing during phase verification.

### NFR-2: Test coverage
≥80% line coverage on every new file (`services/userImportMappers.ts`, `services/workdayImportService.ts`). No regression on existing tests.

### NFR-3: TypeScript strictness
All new code MUST type-check under the project's existing `tsconfig.json` settings. No `// @ts-ignore` directives or `any` casts beyond those already used in the existing service for Supabase typing.

### NFR-4: No new runtime dependencies
The implementation MUST use only libraries already in `package.json`. CSV parsing reuses the existing `xlsx` library (which detects CSV via `XLSX.read(buffer, { type: 'array' })`).

### NFR-5: Backwards compatibility
Existing Workday `.xlsx` files imported successfully today MUST continue to import successfully with no observable change to the resulting profile data (modulo the new region/standardized_role population, which is additive).

## Acceptance Criteria

The track is considered complete when ALL of the following hold:

1. ✅ Importing the real `Employee_Roster_(Active)_-_Unit_Ops` CSV (379 rows) produces non-null `region` for ≥99% of `processedRows` and non-null `standardized_role` for every MX-track title (MxA / MxM / AGM / GM / RD).
2. ✅ Importing a file containing 5 wrong-domain rows results in those rows landing in `wrongDomain[]` with `manager_id` not set anywhere; no `profiles` row is inserted for them; no `auth.users` exception is raised.
3. ✅ Importing a file with the same email on two rows produces one survivor (last occurrence) and one `duplicatesInBatch[]` entry referencing both `sourceRow`s.
4. ✅ Importing a file where every Manager column entry resolves by name (no manager email column) produces `managersLinked == unique manager names` minus `unmappedManager.length` minus `ambiguousManager.length` minus `selfReferenceManager.length`.
5. ✅ Re-uploading any successfully-imported file produces 0 inserts, 0 updates, and `skipped == processedRows`.
6. ✅ For a non-provisioned profile whose `standardized_role` was manually set to MxM, re-uploading a file that maps them to MxA does NOT overwrite the value.
7. ✅ The result panel renders all 12 tiles plus the manager-linkage row; the diagnostics CSV downloads with the documented columns.
8. ✅ Self-reference detection: a row with `managerEmail == workerEmail` is added to `selfReferenceManager[]` with `via: 'email'`; the worker's `manager_id` stays null; no manager profile is created or upgraded for that email.
9. ✅ Test coverage ≥80% on `services/userImportMappers.ts` and `services/workdayImportService.ts`. All new tests pass; existing tests still pass.
10. ✅ A 1,000-row synthetic CSV imports in ≤15 seconds end-to-end on a typical dev machine.

## Out of Scope

- Schema changes / new migrations.
- Backfill of historical profiles with NULL `region` / `standardized_role`.
- Admin UI for editing the location-region or title-role mapping tables.
- Streaming / chunked upload for >10k-row files.
- Edge Function (server-side) processing.
- Workday SaaS direct API integration (still file-based).
- Modifying the auth trigger `handle_new_user` or its FK cascade logic.
- Auto-promoting a profile's *system role* (Admin / Manager / New Hire) based on title.
- Mapping rules for non-MX titles (engineers, marketers, corporate staff).
- Merging duplicate profiles that already exist in the DB.
- Cross-domain email support (single domain `industriousoffice.com` for now).

## Known Limitations (accepted)

- Importer cannot clear field values via re-upload (`shouldUpdateField` rejects empty new values to protect admin overrides).
- Newly-created manager profiles get NULL `region` / `standardized_role` when referenced by `managerEmail` only with no worker row of their own.
- Date parsing assumes V8 (Chrome / Node).
- Email prefetch chunked at 200 emails per query for URL-length safety.

## Behavior Changes vs Current Code (deliberate)

- **Role auto-upgrade now gated by `provisioned`.** Non-provisioned profiles (admin has taken ownership) keep whatever role the admin set. Today's code auto-upgrades any non-Manager non-Admin profile to Manager when they appear as someone's manager_email; the new gate prevents this on non-provisioned profiles.
- **Self-reference detection added** (both email-path and name-path). Today's code creates a self-loop `manager_id` when a worker's manager_email matches their own email.

## Reference

- Full architectural design: `conductor/tracks/import-new-fields_20260426/design.md`.
- Migration source-of-truth for region enum: `supabase/migrations/008_seed_random_regions.sql`.
- Migration source-of-truth for standardized_role enum: `supabase/migrations/009_add_standardized_role.sql`.
- Real-world fixture source: `Employee_Roster_(Active)_-_Unit_Ops (2).xlsx - Sheet1.csv` (sanitized → `tests/fixtures/sample-workday.csv`).
