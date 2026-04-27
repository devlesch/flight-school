---
track_id: import-new-fields_20260426
created: 2026-04-27
status: approved
---

# Bulk User Import — CSV Support, New Fields, and Hardening

## Problem Statement

We are solving the gap where the Admin Dashboard's bulk user import (Workday Import tab, backed by `services/workdayImportService.ts`) has multiple compounding correctness, robustness, and completeness defects, for the Operations/HR Admin team and the downstream cohort and leadership-lookup features that depend on imported profile data, because the importer was built before several schema additions (region, standardized_role) and before realistic-file edge cases (CSV format, name-only manager column, mixed-domain emails, duplicates) became operationally relevant — forcing manual per-row cleanup after every onboarding wave and producing data drift between the importer and the rest of Flight School.

## Success Criteria

- [ ] **CSV is a first-class input format**: `.csv` files (UTF-8, RFC-4180 quoting, optional BOM) parse correctly with the same column auto-detection as `.xlsx`. Both extensions accepted by file picker and validation.
- [ ] **Region populated**: `regionPopulated / processedRows ≥ 0.99` (i.e. at most 1% of pre-flight-survivor rows end up with NULL region). `US East` / `US West` / `US Central` / `CAN East` (and any future `CAN West` / `CAN Central`) all map to the `{East, Central, West}` allowlist via `parseRegionColumn`. Bad source data (states in the region column) is rescued via the location-keyword fallback (HUB Location → Location → State/Province, with state-level lookup using a dedicated `STATE_REGION_MAP`, NOT the keyword map, to avoid Washington-state-vs-DC ambiguity). Canada is treated as East per product decision.
- [ ] **Standardized role mapping is complete**: `inferStandardizedRole` has 100% recall on its five target keywords (`Member Experience Associate`, `Member Experience Manager`, `Assistant General Manager`, `General Manager`, `Regional Director` — case-insensitive substring match). Verified by unit test against the keyword list. Non-MX titles correctly remain NULL by design.
- [ ] **No invalid rows reach DB**: malformed emails, wrong-domain emails (non-`@industriousoffice.com`), and within-batch duplicate emails are rejected client-side before any DB write, with per-row diagnostics; no silent CHECK or FK-constraint violations.
- [ ] **Admin overrides preserved**: on non-provisioned profiles, manually-set fields (`region`, `standardized_role`, `manager_id`, `title`, `department`, `start_date`, `location`) are never overwritten — additive only when existing value is NULL or `provisioned=true`.
- [ ] **Idempotent**: re-uploading the same file produces zero updates, all rows in `skipped`, with telemetry "X rows already up-to-date".
- [ ] **Email hygiene**: emails are lowercased + trimmed before any insert / update / lookup; case-only re-imports are recognized as the same person.
- [ ] **Manager linkage works without a manager-email column**: when only `Manager` (name) is present, the importer resolves to an existing profile by case-insensitive name match against **all profiles in the DB** (not just those in the current batch); ambiguous matches and unmatched names are surfaced in dedicated diagnostic buckets and do NOT create new manager profiles.
- [ ] **Newly-created manager profiles**: when a manager is referenced by `managerEmail` and not yet in the DB, the importer creates the profile but **leaves region and standardized_role NULL** — there's no business title or location to derive them from. These fields are populated when the same person later appears as a worker row (their own row in any future import). This limit is documented in admin-facing telemetry.
- [ ] **Diagnostics complete**: `ImportResult` exposes per-row outcomes; admins can see which rows had unmapped location, unmapped title, dropped domain, dedup collision, ambiguous manager, or constraint failure. UI offers a downloadable CSV of failures and skips for re-upload after correction.
- [ ] **Performance**: a 1,000-row CSV completes in ≤15s (down from ~60s) via chunked parallel writes and a single keyed prefetch.
- [ ] **Backwards compatible**: existing `.xlsx` Workday files still import without changes; existing column auto-detection still works on Workday-style headers.
- [ ] **Test coverage ≥80%** on new mapper, parsing, normalization, and import logic; existing tests unaffected.

## Out of Scope

- Schema changes / new migrations.
- Backfill of historical profiles with NULL region / standardized_role (separate one-shot script if needed).
- Admin UI for editing the location-region or title-role mapping tables.
- Streaming / chunked upload for >10k-row files.
- Edge Function (server-side) processing — keeps client-side approach to preserve existing RLS-based admin gate.
- Workday SaaS direct API integration (still file-based).
- Modifying the auth trigger `handle_new_user` or its FK cascade logic.
- Auto-promoting a profile's *system role* (Admin / Manager / New Hire) based on title — risky behavior change; admins handle promotion manually post-import.
- Adding mapping rules for non-MX titles (engineers, marketers, corporate staff) — they correctly remain NULL.
- Merging duplicate profiles that already exist in the DB — only prevent *new* dupes; existing dupes are a separate cleanup.
- Cross-domain email support (the file used for design grounding is 100% `@industriousoffice.com` — no concrete need today).

## Chosen Approach

**Option A revised — comprehensive single-track hardening.**

All defects addressed together so admins see one coherent improvement to importer trustworthiness. New pure-function mapper module + hardened import service + CSV parsing + pre-flight validation pass + chunked-parallel writes + comprehensive `ImportResult` telemetry + downloadable diagnostics. Rejected alternatives: Option B (phased) leaves admins in a partial-fix state across two ships; Option C (Edge Function rewrite) is overengineering for an internal tool processing hundreds of rows.

## Design

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       AdminDashboard.tsx                             │
│  Workday Import tab                                                  │
│   • file input: accept=".csv,.xlsx,.xls"                             │
│   • handleFileUpload: validates extension, dispatches by type        │
│   • Result panel: shows ALL buckets + "Download diagnostics" CSV     │
└─────────────────────────┬────────────────────────────────────────────┘
                          │
            parseUserImport(file) → ParsedImport
            importUsers(parsed)   → ImportResult
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│       services/workdayImportService.ts (modified, not renamed)       │
│                                                                      │
│  parseUserImport(file): ParsedImport                                 │
│   1. Detect format (csv vs xlsx) by extension + content sniff        │
│   2. Strip UTF-8 BOM if present (CSV)                                │
│   3. Use xlsx lib (already in bundle) to convert both formats to     │
│      rows[][]; xlsx supports CSV via XLSX.read(buffer)               │
│   4. Auto-detect header row (existing logic, EXTENDED patterns)      │
│   5. Build raw UserImportRow per data row                            │
│   6. Apply mappers (region, standardizedRole) per row                │
│                                                                      │
│  importUsers(parsed): ImportResult                                   │
│   PRE-FLIGHT (no DB writes):                                         │
│   • normalize emails (lowercase + trim)                              │
│   • drop empty/malformed → invalidEmail[]                            │
│   • drop wrong-domain → wrongDomain[]                                │
│   • dedupe within batch (last-wins) → duplicatesInBatch[]            │
│   • Each surviving row carries sourceRowIndex (1-based, header       │
│     INCLUDED in the count — matches Excel/Sheets row numbers)        │
│                                                                      │
│   FETCH (2 queries):                                                 │
│   • select('*').in('email', [batch emails]) — chunked into groups    │
│     of 200 to stay under URL-length limits, Promise.all merged.      │
│     Builds existingByEmail map.                                      │
│   • select('id, name, email').not('name', 'is', null) — full profile│
│     directory for name-based manager lookup (email included so       │
│     findManagerByName can detect and skip self-references).          │
│     Builds allProfilesByName map. ~50KB for 1000 profiles.           │
│                                                                      │
│   PASS 2 — managers (chunked + parallel):                            │
│   • SELF-REFERENCE GUARD (both paths): if normalized                 │
│     managerEmail == workerEmail OR a name-lookup hit's email ==      │
│     workerEmail, skip the link. Add to selfReferenceManager[]        │
│     diagnostic; manager_id stays null.                               │
│   • If managerEmail present (and not self) → existing email-keyed    │
│     flow. Newly-created manager profiles (email present, no batch    │
│     row of their own) get NULL region/std_role (no title/location    │
│     signal available — explicit limitation).                         │
│   • Else if managerName only → findManagerByName against             │
│     allProfilesByName with selfEmail=workerEmail (NOT existingByEmail│
│     — managers may not be in the current batch).                     │
│       0 matches → unmappedManager[]                                  │
│       1 match   → link manager_id                                    │
│       2+ matches → ambiguousManager[]                                │
│   • Existing manager profiles: shouldUpdateField gate on             │
│     role / region / standardized_role / title                        │
│   • Chunked Promise.all writes (chunks of 100), single retry on      │
│     transient failure                                                │
│                                                                      │
│   PASS 3 — workers (chunked + parallel):                             │
│   • Partition: needsInsert vs needsUpdate vs noop                    │
│   • Inserts always set region + standardized_role from row           │
│   • Updates use shouldUpdateField gate per field                     │
│   • Chunked Promise.all writes                                       │
│   • Accumulate counters + diagnostics                                │
└─────────────────────────┬────────────────────────────────────────────┘
                          │
            ┌─────────────┴───────────────────┐
            ▼                                 ▼
┌──────────────────────────────────┐  ┌──────────────────────────────┐
│  services/userImportMappers.ts   │  │  Supabase profiles table     │
│  (NEW)                           │  │  • CHECK region (E/C/W)      │
│   • ALLOWED_REGIONS              │  │  • CHECK std_role            │
│   • ALLOWED_STANDARDIZED_ROLES   │  │    (MxA/MxM/AGM/GM/RD)       │
│   • ALLOWED_EMAIL_DOMAINS        │  │  • Domain restriction        │
│   • LOCATION_REGION_MAP          │  │    (auth.users only)         │
│   • STATE_REGION_MAP  (NEW)      │  │  • RLS: admin INSERT/UPDATE  │
│   • parseRegionColumn(raw)       │  └──────────────────────────────┘
│   • inferRegionFromLocation(s)   │
│   • inferRegionFromState(s) (NEW)│
│   • inferStandardizedRole(t)     │
│   • normalizeEmail(e)            │
│   • isValidEmail(e)              │
│   • isAllowedDomain(e)           │
│   • dedupeByEmail(rows)          │
│   • findManagerByName(...)       │
│   • shouldUpdateField(...)       │
└──────────────────────────────────┘
```

Single new module (`userImportMappers.ts`), heavy modification of one existing service (filename preserved to minimize PR diff), light UI updates to AdminDashboard, comprehensive new test suites. Zero schema changes.

### Components

| Component | Type | Description |
|---|---|---|
| `services/userImportMappers.ts` | **NEW** | Pure functions: region parsing/inference, standardized-role inference, email normalization, domain validation, batch dedup, manager-name lookup, field-update gate. All deterministic, all unit-testable. |
| `services/workdayImportService.ts` | **MODIFY (heavy)** | CSV+XLSX parsing, extended column patterns (`title`, `region`, `hub location`, `state/province`), pre-flight validation (with `sourceRowIndex` propagated through every bucket), **two prefetch queries** (existingByEmail keyed on batch emails — chunked at 200/query — and allProfilesByName for manager lookup), name-based manager linkage against the full profile directory with ambiguity detection, chunked parallel writes, expanded `ImportResult`. **Filename preserved** to minimize cross-file diff in this PR. |
| `components/AdminDashboard.tsx` | **MODIFY (light)** | (a) `accept=".csv,.xlsx,.xls"` on input. (b) Update extension check in `handleFileUpload`. (c) Result panel: render bucket counts in a **4×3 grid** (12 tiles): Created, Updated, Skipped, Managers Created, Managers Upgraded, Region Populated, Region Unmapped, Role Populated, Role N/A (non-MX), Wrong Domain, Invalid Email, Within-Batch Duplicates. Region tile shows breakdown ("X from column · Y inferred") in tile subtext. Manager-linkage row below the grid: "Manager linkage: `managersLinked` linked, `unmappedManager.length` unresolved, `ambiguousManager.length` ambiguous, `selfReferenceManager.length` self-reference". (d) "Download diagnostics CSV" button (filename `flight-school-import-diagnostics-${YYYY-MM-DD}.csv`) when any error/skip bucket non-empty. CSV columns: `source_row, email, name, bucket, reason, raw_value`. One row per entry in `invalidEmail`, `wrongDomain`, `duplicatesInBatch`, `unmappedManager`, `ambiguousManager`, `selfReferenceManager`, `failedRows`. **Per-bucket reason mapping**: invalidEmail→`reason` field; wrongDomain→"non-allowed domain: {domain}"; duplicatesInBatch→"duplicate of source_row {keptSourceRow}"; unmappedManager→"manager name '{managerName}' not found in DB"; ambiguousManager→"{matchCount} profiles match name '{managerName}'"; selfReferenceManager→"self-reference (via {via})"; failedRows→`reason` field. (e) `details[]` rendering capped at first 50 entries with "…and N more (see diagnostics CSV)" tail when longer. |
| `tests/unit/userImportMappers.test.ts` | **NEW** | All pure mapper functions. ~25 cases. |
| `tests/unit/userImportService.test.ts` | **NEW** | Parsing (CSV + XLSX, BOM, header detection), pre-flight, import (insert/update gating, idempotency, manager linkage, chunked writes, error accumulation). ~24 cases. |
| `tests/fixtures/sample-workday.csv` | **NEW** | Realistic CSV (sanitized version of the real Employee Roster file): row-3 header, BOM, quoted fields with embedded commas, mixed-case emails, US/CAN regions, state-named region rows, name-only manager column, mixed date formats, unicode names. |
| `tests/fixtures/sample-workday.xlsx` | **NEW** | Mirror XLSX fixture for parity tests. |

### Data Model

No schema changes.

```ts
// services/userImportMappers.ts
export const ALLOWED_REGIONS = ['East', 'Central', 'West'] as const;
export type Region = typeof ALLOWED_REGIONS[number];

export const ALLOWED_STANDARDIZED_ROLES = ['MxA','MxM','AGM','GM','RD'] as const;
export type StandardizedRole = typeof ALLOWED_STANDARDIZED_ROLES[number];

export const ALLOWED_EMAIL_DOMAINS = ['industriousoffice.com'] as const;

// Strips country prefix ('US ', 'CAN ') and validates.
// Canada maps to its US-equivalent region per product decision —
// 'CAN East' → 'East'. See conductor/product-guidelines.md (region taxonomy).
export function parseRegionColumn(raw: string | null | undefined): Region | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Strip leading country code if present (US, CAN, UK, etc.)
  const stripped = trimmed.replace(/^(US|CAN|UK|MEX)\s+/i, '');
  // Title-case-ish match against allowlist (case-insensitive)
  const lc = stripped.toLowerCase();
  if (lc === 'east') return 'East';
  if (lc === 'central') return 'Central';
  if (lc === 'west') return 'West';
  return null; // bad data ('Florida', 'Ohio', etc.) — caller falls back to inferRegion
}

// Fallback: derive region from a free-form location/HUB string.
// Used when Region column is absent or returned null.
// City-level keywords ONLY — state names go through STATE_REGION_MAP.
// Note: 'washington' is intentionally NOT in this map because it would
// collide between Washington DC (East) and Washington state (West).
// DC operations use the 'dmv' HUB Location keyword.
// Source of truth for valid regions: migration 008.
export const LOCATION_REGION_MAP: ReadonlyArray<{ match: string; region: Region }> = [
  // East
  { match: 'new york', region: 'East' },
  { match: 'nyc', region: 'East' },
  { match: 'brooklyn', region: 'East' },
  { match: 'boston', region: 'East' },
  { match: 'philadelphia', region: 'East' },
  { match: 'pittsburgh', region: 'East' },
  { match: 'dmv', region: 'East' },           // DC/Maryland/Virginia HUB
  { match: 'atlanta', region: 'East' },
  { match: 'miami', region: 'East' },
  { match: 'tampa', region: 'East' },
  { match: 'orlando', region: 'East' },
  { match: 'charlotte', region: 'East' },
  { match: 'raleigh', region: 'East' },
  { match: 'charleston', region: 'East' },
  { match: 'toronto', region: 'East' },        // Canada → East per product
  // Central
  { match: 'chicago', region: 'Central' },
  { match: 'austin', region: 'Central' },
  { match: 'dallas', region: 'Central' },
  { match: 'houston', region: 'Central' },
  { match: 'nashville', region: 'Central' },
  { match: 'minneapolis', region: 'Central' },
  { match: 'kansas city', region: 'Central' },
  { match: 'indianapolis', region: 'Central' },
  // West
  { match: 'los angeles', region: 'West' },
  { match: 'orange county', region: 'West' },
  { match: 'san francisco', region: 'West' },
  { match: 'oakland', region: 'West' },
  { match: 'seattle', region: 'West' },
  { match: 'denver', region: 'West' },
  { match: 'phoenix', region: 'West' },
  { match: 'portland', region: 'West' },
  { match: 'san diego', region: 'West' },
];

// State-level fallback. Only used when location-keyword inference fails.
// Exact match (case-insensitive, trimmed) — states are unambiguous.
// 'Washington' state correctly maps to West here (vs Washington DC,
// which is reached via the 'dmv' or DC-specific HUB keywords above).
export const STATE_REGION_MAP: Readonly<Record<string, Region>> = {
  // East
  'new york': 'East',
  'new jersey': 'East',
  'connecticut': 'East',
  'massachusetts': 'East',
  'pennsylvania': 'East',
  'maryland': 'East',
  'virginia': 'East',
  'district of columbia': 'East',
  'dc': 'East',
  'georgia': 'East',
  'florida': 'East',
  'north carolina': 'East',
  'south carolina': 'East',
  'ontario': 'East',           // Canadian province → East per product
  // Central
  'illinois': 'Central',
  'texas': 'Central',
  'tennessee': 'Central',
  'minnesota': 'Central',
  'missouri': 'Central',
  'kansas': 'Central',
  'indiana': 'Central',
  'ohio': 'Central',
  'michigan': 'Central',
  // West
  'california': 'West',
  'washington': 'West',        // Washington state — disambiguated from DC
  'oregon': 'West',
  'colorado': 'West',
  'arizona': 'West',
  'nevada': 'West',
  'utah': 'West',
};

export function inferRegionFromLocation(location: string | null | undefined): Region | null {
  if (!location) return null;
  const lc = location.toLowerCase().trim();
  if (!lc) return null;
  for (const { match, region } of LOCATION_REGION_MAP) {
    if (lc.includes(match)) return region;
  }
  return null;
}

export function inferRegionFromState(state: string | null | undefined): Region | null {
  if (!state) return null;
  const key = state.toLowerCase().trim();
  if (!key) return null;
  return STATE_REGION_MAP[key] ?? null;
}

// Order-sensitive: longest patterns first.
// Source of truth for valid roles: migration 009.
export function inferStandardizedRole(
  businessTitle: string | null | undefined
): StandardizedRole | null {
  if (!businessTitle) return null;
  const lc = businessTitle.toLowerCase().trim();
  if (!lc) return null;
  if (lc.includes('regional director')) return 'RD';
  if (lc.includes('assistant general manager')) return 'AGM';
  if (lc.includes('general manager')) return 'GM';
  if (lc.includes('member experience manager')) return 'MxM';
  if (lc.includes('member experience associate')) return 'MxA';
  return null;
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean { return EMAIL_REGEX.test(email); }

export function isAllowedDomain(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1);
  return ALLOWED_EMAIL_DOMAINS.includes(domain as typeof ALLOWED_EMAIL_DOMAINS[number]);
}

// Operates on rows that carry their own sourceRowIndex (1-based, header-counted).
// Last occurrence of each email wins; earlier occurrences land in `duplicates`
// with both their own sourceRow and the kept row's sourceRow for diagnostics.
export function dedupeByEmail<T extends { email: string; sourceRowIndex: number }>(rows: T[]): {
  unique: T[];
  duplicates: Array<{ sourceRow: number; email: string; keptSourceRow: number; row: T }>;
} {
  // Find the last (winning) array index per email
  const lastArrayIndexFor = new Map<string, number>();
  rows.forEach((r, i) => lastArrayIndexFor.set(r.email, i));
  // Map email → kept row's sourceRowIndex
  const keptSourceRowFor = new Map<string, number>();
  lastArrayIndexFor.forEach((arrayIdx, email) => {
    keptSourceRowFor.set(email, rows[arrayIdx].sourceRowIndex);
  });

  const unique: T[] = [];
  const duplicates: Array<{ sourceRow: number; email: string; keptSourceRow: number; row: T }> = [];
  rows.forEach((r, i) => {
    if (lastArrayIndexFor.get(r.email) === i) {
      unique.push(r);
    } else {
      duplicates.push({
        sourceRow: r.sourceRowIndex,
        email: r.email,
        keptSourceRow: keptSourceRowFor.get(r.email)!,
        row: r,
      });
    }
  });
  return { unique, duplicates };
}

// Returns single match (1 hit), ambiguous (2+ hits), or none (0 hits).
// `selfEmail` lets the caller exclude self-references — when the worker
// row's manager column points to the worker's own profile (data error).
export function findManagerByName(
  name: string,
  profiles: Iterable<{ id: string; name: string; email: string }>,
  selfEmail?: string
): { match: { id: string; name: string; email: string } | null; ambiguous: boolean; count: number } {
  const target = name.trim().toLowerCase();
  if (!target) return { match: null, ambiguous: false, count: 0 };
  const selfKey = selfEmail ? selfEmail.trim().toLowerCase() : null;
  const matches = [...profiles].filter(p => {
    if (p.name.trim().toLowerCase() !== target) return false;
    if (selfKey && p.email.trim().toLowerCase() === selfKey) return false; // skip self
    return true;
  });
  if (matches.length === 0) return { match: null, ambiguous: false, count: 0 };
  if (matches.length === 1) return { match: matches[0], ambiguous: false, count: 1 };
  return { match: null, ambiguous: true, count: matches.length };
}

export function shouldUpdateField<T extends Record<string, unknown>, K extends keyof T>(
  existing: T & { provisioned?: boolean | null },
  fieldName: K,
  newValue: T[K]
): boolean {
  // Note: empty/null new values are NEVER written. This means the importer
  // CANNOT clear a field via re-upload — to clear a value, an admin must
  // edit through the Team Registry UI. Documented in Risks.
  if (newValue == null || newValue === '') return false;
  if (existing[fieldName] === newValue) return false;        // no-op
  return existing.provisioned === true || existing[fieldName] == null;
}
```

```ts
// services/workdayImportService.ts (selected types)

// Returned by parseUserImport. Consumed by importUsers.
export interface ParsedImport {
  rows: UserImportRow[];
  headerRowIndex: number;    // 1-based source-file row where headers were detected
  parseWarnings: string[];   // non-fatal warnings (e.g. "5 rows skipped: empty/sparse")
}

export interface UserImportRow {
  // Source tracking — 1-based row number in the source file, with the
  // header row counted (matches Excel/Sheets row numbers seen by admins).
  // Propagated through pre-flight rejection buckets and failedRows so
  // diagnostics CSVs reference the correct source row.
  sourceRowIndex: number;
  // Existing
  workerName: string;
  firstName: string;
  lastName: string;
  hireDate: string | null;
  terminationDate: string | null;
  managerName: string;
  managerFirstName: string;
  managerLastName: string;
  managerEmail: string;
  businessTitle: string;
  location: string;
  hubLocation: string;       // NEW — preferred for region inference
  stateProvince: string;     // NEW — last-resort region inference
  department: string;
  email: string;
  rawRegion: string;         // NEW — verbatim Region column value
  // Derived
  region: Region | null;
  regionSource: 'column' | 'inferred' | null;  // telemetry
  standardizedRole: StandardizedRole | null;
}

export interface ImportResult {
  // Outcome counts
  parsedRows: number;        // rows that survived raw parsing (before pre-flight)
  processedRows: number;     // rows that survived pre-flight validation
                             //   (parsedRows - invalidEmail.length - wrongDomain.length
                             //    - duplicatesInBatch.length === processedRows).
                             // This is the denominator for region/role coverage metrics.
  created: number;
  updated: number;
  skipped: number;
  managersCreated: number;
  managersUpgraded: number;
  managersLinked: number;    // rows whose manager_id was successfully resolved
  // Region telemetry — counts only processed rows.
  // Invariant: regionFromColumn + regionFromInference + regionUnmapped === processedRows.
  // Convenience: regionPopulated === regionFromColumn + regionFromInference.
  regionPopulated: number;
  regionFromColumn: number;
  regionFromInference: number;
  regionUnmapped: number;
  // Standardized-role telemetry — counts only processed rows.
  // Invariant: standardizedRolePopulated + standardizedRoleNotApplicable === processedRows.
  // ('Not applicable' is the correct outcome for non-MX titles, not a failure.)
  standardizedRolePopulated: number;
  standardizedRoleNotApplicable: number;
  // Pre-flight rejection buckets — sourceRow is 1-based and counts the
  // header row, matching what admins see when they open the file.
  invalidEmail: Array<{ sourceRow: number; raw: string; reason: string }>;
  wrongDomain: Array<{ sourceRow: number; email: string }>;
  duplicatesInBatch: Array<{ sourceRow: number; email: string; keptSourceRow: number }>;
  // Manager-linkage diagnostics
  unmappedManager: Array<{ sourceRow: number; managerName: string }>;
  ambiguousManager: Array<{ sourceRow: number; managerName: string; matchCount: number }>;
  selfReferenceManager: Array<{ sourceRow: number; email: string; via: 'email' | 'name' }>;
  // DB-level failures
  errors: string[];
  failedRows: Array<{ sourceRow: number; email: string; reason: string }>;
  // Free-form audit log
  details: string[];
}
```

**Extended column patterns** (reordered, additions marked NEW):

```ts
const COLUMN_PATTERNS: [keyof UserImportRow, string[]][] = [
  ['managerFirstName', ['manager first name', 'supervisor first name']],
  ['managerLastName',  ['manager last name', 'supervisor last name']],
  ['managerEmail',     ['manager email', 'supervisor email', "manager's email"]],
  ['managerName',      ['manager', 'supervisor', 'reports to']],
  ['firstName',        ['legal name - first name', 'preferred name - first name', 'first name', 'given name']],  // NEW patterns added
  ['lastName',         ['legal name - last name', 'last name', 'family name', 'surname']],                       // NEW patterns added
  ['workerName',       ['full name', 'worker', 'employee name']],
  ['hireDate',         ['hire date', 'start date', 'date of hire', 'original hire']],
  ['terminationDate',  ['termination', 'end date', 'term date']],
  ['businessTitle',    ['business title', 'job title', 'job profile', 'position title', 'title']],               // NEW: bare 'title'
  ['hubLocation',      ['hub location', 'hub']],                                                                  // NEW
  ['location',         ['work location', 'office', 'site', 'location']],
  ['stateProvince',    ['state/province', 'state', 'province']],                                                  // NEW
  ['rawRegion',        ['region']],                                                                               // NEW
  ['department',       ['department', 'cost center', 'org unit', 'supervisory']],
  ['email',            ['email - primary work', 'primary work email', 'work email', 'email address', 'worker email', 'primary email', 'email']],
];
```

### User Flow

**Happy path — admin imports the 379-row Employee Roster CSV:**

1. Admin clicks **Workday Import**.
2. File picker shows `*.csv, *.xlsx, *.xls`.
3. Admin selects `Employee_Roster_Active_Unit_Ops.csv`.
4. `handleFileUpload`: extension check passes → spinner.
5. `parseUserImport(file)`:
   - BOM stripped if present.
   - xlsx lib parses CSV → rows[][].
   - Header detected at row 3 (rows 1-2 are metadata).
   - 379 raw rows produced.
   - Per row: `parseRegionColumn(rawRegion)` runs first; if null, `inferRegionFromLocation(hubLocation || location)` runs; if still null, `inferRegionFromState(stateProvince)` runs as last-resort. `inferStandardizedRole(title)` runs always. `regionSource` is set to `'column' | 'inferred' | null` accordingly.
6. `importUsers(parsed)`:
   - Pre-flight: 379 emails normalized; 0 invalid; 0 wrong-domain; 0 within-batch duplicates → 379 rows survive. Each carries its `sourceRowIndex` (4..382, header at row 3).
   - Two prefetch queries in parallel:
     - `select('*').in('email', […379 emails])` chunked into 200+179 → existingByEmail map.
     - `select('id, name, email').not('name','is',null)` → allProfilesByName map (full profile directory with email for self-reference detection; ~50KB).
   - Pass 2 (managers): `Manager` column has names only (no email). For each unique (managerName, workerEmail) pair, `findManagerByName(managerName, allProfilesByName, selfEmail=workerEmail)` runs against **allProfilesByName** (not existingByEmail). E.g. "Nicole Anglesey" exists in the DB but isn't in this Unit Ops file — she's still found and linked. Of ~30 unique manager names, suppose 28 match (linked), 1 ambiguous (logged), 1 truly unmatched (logged). No new manager profiles created from name-only data.
   - Pass 3 (workers): partition into needsInsert / needsUpdate / noop. Chunked Promise.all writes (e.g. 4 chunks of 100, 1 chunk of 79). Region populated from column for 374 rows; via location-keyword fallback for 4 rows (state-named source data — Tampa→East, NYC→East, Pittsburgh→East); via state fallback for 1 row (Ohio→Central via STATE_REGION_MAP since "Remote - OH" doesn't match any city keyword). All 379 rows have non-null region (100% coverage on this fixture).
   - Total wall-clock ~3-5s.
7. Result panel renders 4×3 grid plus manager-linkage row.
8. If any failure bucket non-empty: "Download diagnostics CSV" button generates a CSV listing every problematic row by index/email/reason.

**Re-upload same file (idempotency):**

- All 379 rows resolve to no-op updates → 0 inserts, 0 updates, 379 skipped.
- Result: "379 rows already up-to-date. No changes."

**Manual edit preservation:**

- Admin manually changes Jane's `standardized_role` MxA → MxM via Team Registry. Existing flow sets `provisioned=false`.
- Next import: `shouldUpdateField(existing, 'standardized_role', 'MxA')` → existing is MxM, provisioned is false, existing field is non-null → returns false. Jane's manual MxM preserved.

### Error Handling

| Scenario | Behavior |
|---|---|
| Empty file | `parseUserImport` throws "File is empty"; no DB calls. |
| File with no detectable header | Existing diagnostic-rich error message preserved; no DB calls. |
| BOM at start of CSV | Stripped during parse. |
| RFC-4180 quoted field with embedded comma / newline | Handled by `xlsx` library; verified by fixture. |
| Mixed line endings (CRLF/LF) | Handled by `xlsx` library; verified by fixture. |
| Email empty / malformed | → `invalidEmail`. Not persisted. |
| Email wrong domain | → `wrongDomain`. Not persisted. |
| Email duplicated within batch | Last occurrence wins; earlier flagged in `duplicatesInBatch`. |
| Email same as existing profile but different case | Normalized; treated as same person on update path. |
| Manager email present | Existing email-keyed flow, unchanged. |
| Manager name only, 0 DB matches | → `unmappedManager`. `manager_id` left null on the worker row. No new manager profile created. |
| Manager name only, 1 DB match | Linked. |
| Manager name only, 2+ DB matches | → `ambiguousManager`. `manager_id` left null. |
| Manager email is the worker's own email | Self-reference guard fires before any link/profile-creation. Added to `selfReferenceManager[]` with `via: 'email'`. `manager_id` stays null; no manager profile created or upgraded for this email. |
| Region column = "US East" / "CAN East" / etc. | `parseRegionColumn` strips prefix → East/Central/West. `regionSource = 'column'`. |
| Region column = state name ("Florida") | `parseRegionColumn` returns null → `inferRegionFromLocation(hubLocation)` runs → Tampa → East. `regionSource = 'inferred'`. |
| Region column null, HUB Location unmapped | Falls through to `inferRegionFromState(stateProvince)` — uses the dedicated STATE_REGION_MAP (e.g. "Washington" → West, NOT East). |
| Region column unrecognized AND all fallbacks unmapped | `region = null`, `regionSource = null`; counted in `regionUnmapped`. |
| Worker row lists themselves as their own manager (by name) | `findManagerByName` skips self-matches via `selfEmail` parameter. Added to `selfReferenceManager[]` with `via: 'name'`. If a different person with the same name exists in the directory, link to them; otherwise `manager_id` stays null. |
| Title doesn't match any pattern | `standardizedRole = null`; counted in `standardizedRoleNotApplicable` (display label "not applicable" — this is the correct outcome for non-MX titles, not a failure). |
| Inferred value somehow not in allowlist (impossible by construction, defensive) | Treated as null; row not blocked. |
| Existing profile has region not in allowlist (legacy data) | Left untouched; we never read-then-validate. |
| Date cell unparseable | `start_date` left null; row continues. |
| Terminated worker row | Skipped (existing behavior, preserved). |
| Single chunk failure (transient network error) | Retried once; on second failure all rows in that chunk → `failedRows` (with their `sourceRow`); other chunks unaffected. |
| Whole-import failure (e.g. fetch query rejected) | `result.errors` populated; UI shows alert; nothing partially committed. |
| Email prefetch query exceeds URL-length limit (>~200 emails per query) | Prefetch is chunked into groups of 200 + Promise.all-merged. Transparent to the rest of the flow. |
| Date cell in non-V8 runtime returns Invalid Date for `M/D/YY` | Tested against V8 (Chrome/Node). Documented limitation: this codebase targets V8-based runtimes only. |
| Workday clears a field (e.g. department becomes blank for a transferred employee) | The importer does NOT clear values via re-upload. `shouldUpdateField` rejects empty new values. Admin must clear via Team Registry UI. Documented in Risks. |

### Testing Strategy

Per `workflow.md`: TDD, ≥80% coverage. Tests written before implementation.

**`tests/unit/userImportMappers.test.ts`** (NEW, ~25 cases):
- `parseRegionColumn`: "US East"→East; "US West"→West; "US Central"→Central; "CAN East"→East; "CAN West"→West (defensive); lowercase variants; "Florida"→null; "Ohio"→null; null/empty/whitespace.
- `inferRegionFromLocation`: each LOCATION_REGION_MAP entry; mixed case; whitespace; null/empty; unknown city → null. **Critical regression test:** `inferRegionFromLocation("Seattle - 2033 6th Ave")` → West (not East — guards against re-introducing 'washington' to LOCATION_REGION_MAP).
- `inferRegionFromState`: 'Washington' → West (NOT East — disambiguated from DC); 'New York' → East; 'Ontario' → East; case-insensitive; trim; unknown state → null; null/empty.
- `inferStandardizedRole`: each of the five target keywords → corresponding role (recall = 100% by unit test enumeration); AGM-vs-GM specificity ("Assistant General Manager" → AGM not GM); prefix variants ("Senior General Manager - NYC" → GM); non-MX titles ("Hospitality Manager", "Director of Operations") → null; null/empty.
- `normalizeEmail`: lowercases, trims, idempotent, null-safe.
- `isValidEmail`, `isAllowedDomain`: positive/negative cases.
- `dedupeByEmail`: last-wins; `unique` retains the kept rows; `duplicates` entries carry `sourceRow` and `keptSourceRow` matching the input rows' `sourceRowIndex`. Empty input edge case. All-duplicate edge case.
- `findManagerByName`: 0/1/2+ matches; case-insensitivity; trim; **self-reference exclusion** — when `selfEmail` is supplied and matches a candidate's email, that candidate is filtered out (test: same name, same email → 0 matches; same name, different email → 1 match).
- `shouldUpdateField`: provisioned + diff → true; non-provisioned + null existing + non-null new → true; non-provisioned + non-null existing + diff new → false; identical values → false; null/empty new → false.

**`tests/unit/userImportService.test.ts`** (NEW, ~24 cases):
- `parseUserImport(csvFile)`: parses sample CSV; strips BOM; handles quoted fields with embedded commas; handles CRLF; handles row-3 header (preceded by metadata rows); produces same output structure as XLSX equivalent.
- `parseUserImport`: each row carries `sourceRowIndex` matching its 1-based position in the source file (header counted). Surviving row 4 in source → `sourceRowIndex === 4`.
- `parseUserImport`: derived `region` via column path for `US East` rows; via location-keyword inference for state-named-region rows whose HUB resolves; via state fallback for rows whose HUB doesn't resolve but State/Province does; null only when all three paths fail. `regionSource` reflects which path won.
- `parseUserImport`: derived `standardizedRole` populated for MX titles, null for others.
- `parseUserImport`: extended column patterns work — bare "Title" detected, "Region" detected, "HUB Location" preferred over "Location".
- `parseUserImport`: date formats — `4/20/2026` and `5/21/18` both produce valid ISO dates (V8-only assertion documented in test).
- `importUsers` pre-flight: drops wrong-domain rows; doesn't issue insert calls; rejection bucket entries carry correct `sourceRow`.
- `importUsers` pre-flight: drops invalid emails; doesn't issue insert calls.
- `importUsers` pre-flight: dedupes within batch; later occurrence kept; `duplicatesInBatch` references both `sourceRow` and `keptSourceRow`.
- `importUsers` prefetch chunking: 250-email batch issues 2 chunked prefetch queries (200 + 50) merged via Promise.all.
- `importUsers` prefetch directory: name-based manager lookup uses `select('id, name, email')` of ALL profiles, not just batch members. Test: a manager exists in DB but is NOT in batch — still resolved.
- `importUsers` self-reference (email path): worker row with `managerEmail == workerEmail` → no link, no manager profile created/upgraded for that email; entry added to `selfReferenceManager[]` with `via: 'email'`.
- `importUsers` self-reference (name path): worker row whose `managerName` matches their own profile's name (same email) → `findManagerByName` filters self out; entry added to `selfReferenceManager[]` with `via: 'name'`.
- `importUsers` state fallback: row with Region=null, HUB unmapped (e.g. "Remote - OH"), State="Ohio" → `inferRegionFromState` resolves to Central. End-to-end assertion through `parseUserImport` + `importUsers`.
- `importUsers` insert path: new profile gets all fields including region + standardized_role.
- `importUsers` insert path: new manager profile (when manager email present, no batch row for the manager) gets NULL region/std_role — explicitly asserts the documented limitation.
- `importUsers` manager linkage: name-only match path (1 hit), unmappedManager path (0 hits), ambiguousManager path (2+ hits — fixture deliberately includes two profiles with the same name).
- `importUsers` update path: provisioned profile gets updates; non-provisioned with null existing gets fill-in update; non-provisioned with non-null existing left alone.
- `importUsers` update path: empty new value never overwrites existing non-null value (asserts the "cannot clear via import" limitation).
- `importUsers` idempotency: re-importing identical data → 0 inserts, 0 updates, all in `skipped`.
- `importUsers` cross-format idempotency: yesterday's import filled region via inference; today's same data with explicit Region column produces no update (same final value).
- `importUsers` chunking: 250-row batch issues 3 insert chunks (100/100/50); uses `Promise.all` not `allSettled`.
- `importUsers` failure: chunk error → retried once → on failure rows added to `failedRows` with correct `sourceRow`; other chunks succeed.
- `importUsers` ImportResult counters accumulate correctly.
- `importUsers` diagnostics CSV generation: produces a CSV with columns `source_row, email, name, bucket, reason, raw_value`; one row per entry across all rejection/failure buckets.

**Fixtures:**
- `tests/fixtures/sample-workday.csv` — sanitized version of real Employee Roster (names → "User N", emails → "user.N@industriousoffice.com"). Includes: row-3 header, BOM, embedded-comma quoted titles, US East/West/Central + CAN East rows, state-named region rows, name-only Manager column (with one duplicate name to exercise ambiguity), mixed date formats (4-digit and 2-digit year), unicode names.
- `tests/fixtures/sample-workday.xlsx` — mirror XLSX for parity.

Coverage target: ≥80% on new files; no regression on existing tests.

### Aesthetic Direction

Light revision in result panel: existing card classes reused; the result grid expands from 4 tiles to a 4×3 (12-tile) grid plus a manager-linkage row. Tile semantics:
- **Success tones** (existing green/blue/teal palette): Created, Updated, Skipped, Managers Created, Managers Upgraded, Region Populated, Role Populated.
- **Neutral tone** (muted-cream `#F3EEE7`/30 — not a failure): Role N/A — non-MX titles are correctly NULL by design.
- **Soft-warning tone** (muted-amber): Region Unmapped — admin should investigate but the import succeeded.
- **Hard-rejection tone** (muted-red): Wrong Domain, Invalid Email, Within-Batch Duplicates — rows did not reach the DB.

All within the brand palette (Deep Teal `#013E3F`, Warm Cream `#F3EEE7`, Golden Yellow `#FDD344`). Region Populated tile shows a small subtext breakdown ("X from column · Y inferred") below the headline number. "Download diagnostics CSV" button uses existing `bg-[#FDD344] text-[#013E3F]` CTA style. No new tokens, no new components.

## Grounding Notes

- Verified `xlsx` library (already in bundle) parses CSV via `XLSX.read(buffer, { type: 'array' })` — no new dependency.
- Verified `services/workdayImportService.ts:33-47` column patterns — confirmed the `Title` / `Region` / `HUB Location` / `State/Province` columns are NOT currently captured.
- Verified `cohortService.ts:320` cohort matching depends on both `standardized_role` AND `region`.
- Verified `useLeadershipTeam.ts` filters by `standardized_role`.
- Verified `AdminDashboard.tsx:847` accept attribute is `.xlsx,.xls` only despite line 845 advertising "CSV or Excel".
- Verified migration 003 enforces domain restriction at OAuth time only — importer-created profiles with non-Industrious emails become permanently unloggable.
- Verified Manual Hire form (`AdminDashboard.tsx:528-544`) and Edit form (`:559-580`) already persist `region` and `standardized_role` — proving the data path works end-to-end except in the importer.
- Verified RLS allows admin INSERT (migration 004 line 80-82) and UPDATE (migration 001 line 193-194).
- Profiled the real `Employee_Roster_(Active)_-_Unit_Ops` CSV: 379 data rows, 16 columns, header on row 3, 369 rows (97.4%) with `US X` region values, 5 rows (1.3%) with `CAN East` (Toronto), 5 rows (1.3%) with state-named region values, name-only Manager column.

## Party Panel Insights

- **Pre-flight validation pass** is the architectural keystone (Murat) — separates validation problems from persistence problems.
- **`Promise.all` not `allSettled`** for chunked writes (Backend Architect) — whole-chunk failure attribution is the right granularity for this scale.
- **Downloadable diagnostics CSV** is a must-have, not nice-to-have (Reality Checker) — turns "something failed" into "here are 7 specific rows to fix".
- **Hardcoded mapping tables, not DB-driven** (Winston) — taxonomy churn is too low (~1-2 events/year) to justify infrastructure.
- **Manager-name lookup, no synthetic-email construction** (file analysis) — email format inconsistency in the source makes synthetic construction unreliable.
- **Canada → East per product** (Adrien, 2026-04-27) — small population (5/379), no schema gap created.

## Risks & Open Questions

**Risks:**
- **Mapping table coverage** — keyword tables for location → region need maintenance when Industrious opens a new market. Mitigation: hardcoded with comment-link to migration 008 source of truth; admins see "Unmapped Region: N" telemetry and can request a code update.
- **Manager-name collision** — two profiles with identical names cause `ambiguousManager` log; no auto-resolution. Mitigation: surface in result panel; admin manually links via Team Registry.
- **Wrong-domain false-rejection** — if Industrious legitimately uses a second email domain (e.g. acquisition), they'll be excluded. Mitigation: `ALLOWED_EMAIL_DOMAINS` is a documented array, easy to extend.
- **Performance on small files** — chunked Promise.all overhead is negligible on small files but adds tiny constant cost. Negligible.

**Known limitations (documented, accepted):**
- **Importer cannot clear field values.** `shouldUpdateField` rejects empty/null new values to protect admin overrides — but this means a Workday change from "Unit Ops" to blank cannot be applied via re-upload. Admin must clear via Team Registry UI. Acceptable: HR fields are rarely blanked (employees are terminated, not partially-blanked).
- **Newly-created manager profiles get NULL region/std_role** when the manager is referenced by `managerEmail` only and has no worker row in the batch. There's no title or location signal to infer from. They're populated when the same person later appears as a worker in any future import. In practice this is rare (full-roster files include managers as worker rows).
- **Date parsing assumes V8** (Chrome/Node). `new Date("5/21/18")` is non-standard JS; behavior is locked by tests against V8 only. Acceptable since this codebase targets modern Chromium-based runtimes.
- **Email prefetch URL length** — chunked at 200 emails per query to stay under PostgREST URL-length limits. Transparent; documented for future maintainers.

**Behavior changes vs current code (deliberate, not regressions):**
- **Role auto-upgrade now gated by `provisioned`.** Today, `importWorkdayData` will upgrade any non-Manager non-Admin profile to Manager when they appear as someone's manager_email. The new gate (`shouldUpdateField`) means non-provisioned profiles (admin has taken ownership) keep whatever role the admin set. This protects admin intent at the cost of one observable difference: a profile manually set to 'New Hire' that becomes someone's manager in Workday will no longer be auto-upgraded. Admin can manually upgrade via Team Registry.
- **Self-reference detection added** (both email-path and name-path). Today, a worker row with `managerEmail == workerEmail` creates a self-loop in `manager_id`. The new code blocks this and surfaces the row in `selfReferenceManager[]`.

**Open Questions (deferred to follow-up tracks):**
- Should Flight School represent Canadian regions natively (separate cohort cadence, leadership matrix)? Today: Canada → East per product. Revisit if Canadian operations grow.
- Should the importer auto-promote system role to `Manager` when title implies management? Today: no. Admins handle promotion manually post-import.
- Should "Senior General Manager" be a distinct standardized_role tier? Currently maps to GM via substring match. May be a false positive if Industrious treats Senior GM as a higher rank — confirm with HR. If so, add a sixth enum value or refine the matcher to exclude "senior" prefix.
- Should there be a one-shot backfill script for already-imported profiles with NULL `region` / `standardized_role`? Out of scope for this track — propose as a separate operational ticket.
