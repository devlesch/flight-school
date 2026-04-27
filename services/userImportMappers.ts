// Pure helper functions for the bulk user import pipeline.
// All functions are deterministic, side-effect-free, and unit-testable in isolation.
//
// Source of truth for the enum values below:
//   region            → supabase/migrations/008_seed_random_regions.sql
//   standardized_role → supabase/migrations/009_add_standardized_role.sql
//   email domain      → supabase/migrations/003_restrict_domain.sql

export const ALLOWED_REGIONS = ['East', 'Central', 'West'] as const;
export type Region = (typeof ALLOWED_REGIONS)[number];

export const ALLOWED_STANDARDIZED_ROLES = ['MxA', 'MxM', 'AGM', 'GM', 'RD'] as const;
export type StandardizedRole = (typeof ALLOWED_STANDARDIZED_ROLES)[number];

export const ALLOWED_EMAIL_DOMAINS = ['industriousoffice.com'] as const;

// ---------------------------------------------------------------------------
// Region resolution
// ---------------------------------------------------------------------------

// Strips a leading country code prefix ('US ', 'CAN ', etc.) from the raw
// Region column value, then validates against the allowlist.
// Canada maps to its US-equivalent region per product decision: 'CAN East' → East.
export function parseRegionColumn(raw: string | null | undefined): Region | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^(US|CAN|UK|MEX)\s+/i, '');
  const lc = stripped.toLowerCase();
  if (lc === 'east') return 'East';
  if (lc === 'central') return 'Central';
  if (lc === 'west') return 'West';
  return null;
}

// City-level keyword fallback used when the Region column is absent or invalid.
// 'washington' is intentionally NOT here — it would collide between
// Washington DC (East) and Washington state (West). DC operations are reached
// via the 'dmv' HUB Location keyword.
export const LOCATION_REGION_MAP: ReadonlyArray<{ match: string; region: Region }> = [
  // East
  { match: 'new york', region: 'East' },
  { match: 'nyc', region: 'East' },
  { match: 'brooklyn', region: 'East' },
  { match: 'boston', region: 'East' },
  { match: 'philadelphia', region: 'East' },
  { match: 'pittsburgh', region: 'East' },
  { match: 'dmv', region: 'East' },
  { match: 'atlanta', region: 'East' },
  { match: 'miami', region: 'East' },
  { match: 'tampa', region: 'East' },
  { match: 'orlando', region: 'East' },
  { match: 'charlotte', region: 'East' },
  { match: 'raleigh', region: 'East' },
  { match: 'charleston', region: 'East' },
  { match: 'toronto', region: 'East' },
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
// 'washington' state correctly maps to West here (vs Washington DC,
// reached via the 'dmv' or DC-specific HUB keywords).
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
  'ontario': 'East',
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
  'washington': 'West',
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

// ---------------------------------------------------------------------------
// Standardized role resolution
// ---------------------------------------------------------------------------

// Order-sensitive: longest patterns first so that "Assistant General Manager"
// resolves to AGM and not GM.
export function inferStandardizedRole(
  businessTitle: string | null | undefined,
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

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isAllowedDomain(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1);
  return ALLOWED_EMAIL_DOMAINS.includes(domain as (typeof ALLOWED_EMAIL_DOMAINS)[number]);
}

// ---------------------------------------------------------------------------
// Within-batch deduplication
// ---------------------------------------------------------------------------

// Last occurrence of each email wins. Earlier occurrences land in `duplicates`
// with both their own sourceRow and the kept row's sourceRow for diagnostics.
export function dedupeByEmail<T extends { email: string; sourceRowIndex: number }>(
  rows: T[],
): {
  unique: T[];
  duplicates: Array<{ sourceRow: number; email: string; keptSourceRow: number; row: T }>;
} {
  const lastArrayIndexFor = new Map<string, number>();
  rows.forEach((r, i) => lastArrayIndexFor.set(r.email, i));
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

// ---------------------------------------------------------------------------
// Manager name lookup with self-reference guard
// ---------------------------------------------------------------------------

// `selfEmail` lets the caller exclude self-references: when the worker row's
// manager column points to the worker's own profile (data error), filter it
// out of the candidate set.
export function findManagerByName(
  name: string,
  profiles: ReadonlyArray<{ id: string; name: string; email: string }>,
  selfEmail?: string,
): {
  match: { id: string; name: string; email: string } | null;
  ambiguous: boolean;
  count: number;
} {
  const target = name.trim().toLowerCase();
  if (!target) return { match: null, ambiguous: false, count: 0 };
  const selfKey = selfEmail ? selfEmail.trim().toLowerCase() : null;
  const matches = profiles.filter((p) => {
    if (p.name.trim().toLowerCase() !== target) return false;
    if (selfKey && p.email.trim().toLowerCase() === selfKey) return false;
    return true;
  });
  if (matches.length === 0) return { match: null, ambiguous: false, count: 0 };
  if (matches.length === 1) return { match: matches[0], ambiguous: false, count: 1 };
  return { match: null, ambiguous: true, count: matches.length };
}

// ---------------------------------------------------------------------------
// Update gate — protects admin overrides on non-provisioned profiles
// ---------------------------------------------------------------------------

// Returns true only when ALL hold:
//   - newValue is non-null and non-empty.
//   - existing[fieldName] !== newValue (no-op detection).
//   - Either profile is still provisioned OR existing field is null.
//
// Note: empty/null new values are NEVER written. The importer cannot clear a
// field via re-upload — admins must clear via the Team Registry UI.
export function shouldUpdateField<T extends Record<string, unknown>, K extends keyof T>(
  existing: T & { provisioned?: boolean | null },
  fieldName: K,
  newValue: T[K],
): boolean {
  if (newValue == null || newValue === '') return false;
  if (existing[fieldName] === newValue) return false;
  return existing.provisioned === true || existing[fieldName] == null;
}
