import { describe, it, expect } from 'vitest';
import {
  ALLOWED_REGIONS,
  ALLOWED_STANDARDIZED_ROLES,
  ALLOWED_EMAIL_DOMAINS,
  LOCATION_REGION_MAP,
  STATE_REGION_MAP,
  parseRegionColumn,
  inferRegionFromLocation,
  inferRegionFromState,
  inferStandardizedRole,
  normalizeEmail,
  isValidEmail,
  isAllowedDomain,
  dedupeByEmail,
  findManagerByName,
  shouldUpdateField,
} from '../../services/userImportMappers';

describe('userImportMappers — constants', () => {
  it('ALLOWED_REGIONS matches DB CHECK (migration 008)', () => {
    expect([...ALLOWED_REGIONS]).toEqual(['East', 'Central', 'West']);
  });

  it('ALLOWED_STANDARDIZED_ROLES matches DB CHECK (migration 009)', () => {
    expect([...ALLOWED_STANDARDIZED_ROLES]).toEqual(['MxA', 'MxM', 'AGM', 'GM', 'RD']);
  });

  it('ALLOWED_EMAIL_DOMAINS lists Industrious primary domain', () => {
    expect([...ALLOWED_EMAIL_DOMAINS]).toEqual(['industriousoffice.com']);
  });
});

describe('parseRegionColumn', () => {
  it('strips US prefix → East/Central/West', () => {
    expect(parseRegionColumn('US East')).toBe('East');
    expect(parseRegionColumn('US Central')).toBe('Central');
    expect(parseRegionColumn('US West')).toBe('West');
  });

  it('strips CAN prefix → maps Canada to its US-equivalent region (product decision)', () => {
    expect(parseRegionColumn('CAN East')).toBe('East');
    expect(parseRegionColumn('CAN West')).toBe('West');
    expect(parseRegionColumn('CAN Central')).toBe('Central');
  });

  it('handles lowercase / mixed-case input', () => {
    expect(parseRegionColumn('us east')).toBe('East');
    expect(parseRegionColumn('Us EaSt')).toBe('East');
    expect(parseRegionColumn('east')).toBe('East');
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseRegionColumn('  US East  ')).toBe('East');
  });

  it('returns null for state names in region column (bad source data)', () => {
    expect(parseRegionColumn('Florida')).toBeNull();
    expect(parseRegionColumn('Ohio')).toBeNull();
    expect(parseRegionColumn('New York')).toBeNull();
    expect(parseRegionColumn('Pennsylvania')).toBeNull();
  });

  it('returns null for null / undefined / empty / whitespace', () => {
    expect(parseRegionColumn(null)).toBeNull();
    expect(parseRegionColumn(undefined)).toBeNull();
    expect(parseRegionColumn('')).toBeNull();
    expect(parseRegionColumn('   ')).toBeNull();
  });
});

describe('inferRegionFromLocation', () => {
  it('maps known US East cities', () => {
    expect(inferRegionFromLocation('NYC - 190 Bowery')).toBe('East');
    expect(inferRegionFromLocation('Boston - Seaport')).toBe('East');
    expect(inferRegionFromLocation('Tampa - 615 Channelside Dr')).toBe('East');
    expect(inferRegionFromLocation('Pittsburgh - 1001 Liberty Ave')).toBe('East');
    expect(inferRegionFromLocation('DMV')).toBe('East');
  });

  it('maps Canadian cities to East per product (Toronto)', () => {
    expect(inferRegionFromLocation('Toronto')).toBe('East');
    expect(inferRegionFromLocation('Toronto - 33 Bloor St')).toBe('East');
  });

  it('maps known Central cities', () => {
    expect(inferRegionFromLocation('Chicago - West Loop')).toBe('Central');
    expect(inferRegionFromLocation('Austin - 2nd Street')).toBe('Central');
    expect(inferRegionFromLocation('Kansas City Downtown')).toBe('Central');
  });

  it('maps known West cities', () => {
    expect(inferRegionFromLocation('Los Angeles - 6060 Center Dr')).toBe('West');
    expect(inferRegionFromLocation('San Francisco - Market St')).toBe('West');
    expect(inferRegionFromLocation('Seattle - 2033 6th Ave')).toBe('West');
    expect(inferRegionFromLocation('LA - Orange County')).toBe('West');
  });

  it('CRITICAL REGRESSION: "Seattle" location returns West (not East)', () => {
    // Guards against re-introducing 'washington' to the location map,
    // which would falsely match Washington-state cities to East.
    expect(inferRegionFromLocation('Seattle - 2033 6th Ave (Downtown)')).toBe('West');
    expect(inferRegionFromLocation('Seattle')).toBe('West');
  });

  it('returns null for unknown city', () => {
    expect(inferRegionFromLocation('London')).toBeNull();
    expect(inferRegionFromLocation('Berlin Office')).toBeNull();
    expect(inferRegionFromLocation('Remote - OH')).toBeNull(); // no city keyword matches
  });

  it('returns null for null/undefined/empty/whitespace', () => {
    expect(inferRegionFromLocation(null)).toBeNull();
    expect(inferRegionFromLocation(undefined)).toBeNull();
    expect(inferRegionFromLocation('')).toBeNull();
    expect(inferRegionFromLocation('   ')).toBeNull();
  });

  it('output is always a member of ALLOWED_REGIONS or null', () => {
    const samples = [
      'NYC', 'Chicago', 'Seattle', 'London', 'Toronto', '', 'Tampa',
    ];
    for (const s of samples) {
      const r = inferRegionFromLocation(s);
      if (r !== null) {
        expect(ALLOWED_REGIONS).toContain(r);
      }
    }
  });
});

describe('inferRegionFromState', () => {
  it('CRITICAL: Washington state maps to West, NOT East', () => {
    expect(inferRegionFromState('Washington')).toBe('West');
    expect(inferRegionFromState('washington')).toBe('West');
  });

  it('maps East Coast states correctly', () => {
    expect(inferRegionFromState('New York')).toBe('East');
    expect(inferRegionFromState('Florida')).toBe('East');
    expect(inferRegionFromState('Pennsylvania')).toBe('East');
    expect(inferRegionFromState('Massachusetts')).toBe('East');
  });

  it('maps DC variants to East', () => {
    expect(inferRegionFromState('DC')).toBe('East');
    expect(inferRegionFromState('District of Columbia')).toBe('East');
  });

  it('maps Canadian provinces to East per product', () => {
    expect(inferRegionFromState('Ontario')).toBe('East');
  });

  it('maps Central states correctly', () => {
    expect(inferRegionFromState('Illinois')).toBe('Central');
    expect(inferRegionFromState('Texas')).toBe('Central');
    expect(inferRegionFromState('Ohio')).toBe('Central');
  });

  it('maps West states correctly', () => {
    expect(inferRegionFromState('California')).toBe('West');
    expect(inferRegionFromState('Oregon')).toBe('West');
    expect(inferRegionFromState('Colorado')).toBe('West');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(inferRegionFromState('  CALIFORNIA  ')).toBe('West');
    expect(inferRegionFromState('new york')).toBe('East');
  });

  it('returns null for unknown state', () => {
    expect(inferRegionFromState('Atlantis')).toBeNull();
    expect(inferRegionFromState('Foobar')).toBeNull();
  });

  it('returns null for null/undefined/empty/whitespace', () => {
    expect(inferRegionFromState(null)).toBeNull();
    expect(inferRegionFromState(undefined)).toBeNull();
    expect(inferRegionFromState('')).toBeNull();
    expect(inferRegionFromState('   ')).toBeNull();
  });
});

describe('inferStandardizedRole', () => {
  it('maps each of the five target keywords to its enum value', () => {
    expect(inferStandardizedRole('Regional Director')).toBe('RD');
    expect(inferStandardizedRole('Assistant General Manager')).toBe('AGM');
    expect(inferStandardizedRole('General Manager')).toBe('GM');
    expect(inferStandardizedRole('Member Experience Manager')).toBe('MxM');
    expect(inferStandardizedRole('Member Experience Associate')).toBe('MxA');
  });

  it('SPECIFICITY: "Assistant General Manager" returns AGM, NOT GM', () => {
    expect(inferStandardizedRole('Assistant General Manager')).toBe('AGM');
    expect(inferStandardizedRole('assistant general manager')).toBe('AGM');
  });

  it('handles prefix variants via substring match', () => {
    expect(inferStandardizedRole('Senior General Manager - NYC')).toBe('GM');
    expect(inferStandardizedRole('General Manager - NYC')).toBe('GM');
    expect(inferStandardizedRole('Acting Regional Director')).toBe('RD');
  });

  it('returns null for non-MX titles', () => {
    expect(inferStandardizedRole('Hospitality Manager')).toBeNull();
    expect(inferStandardizedRole('Director of Operations')).toBeNull();
    expect(inferStandardizedRole('Software Engineer')).toBeNull();
    expect(inferStandardizedRole('Workplace Experience Manager')).toBeNull();
    expect(inferStandardizedRole('Building Experience Coordinator')).toBeNull();
    expect(inferStandardizedRole('VP')).toBeNull();
  });

  it('returns null for null/undefined/empty', () => {
    expect(inferStandardizedRole(null)).toBeNull();
    expect(inferStandardizedRole(undefined)).toBeNull();
    expect(inferStandardizedRole('')).toBeNull();
    expect(inferStandardizedRole('   ')).toBeNull();
  });

  it('output is always a member of ALLOWED_STANDARDIZED_ROLES or null', () => {
    const samples = [
      'Regional Director', 'General Manager', 'Software Engineer',
      'Member Experience Associate', '', 'Random Title',
    ];
    for (const s of samples) {
      const r = inferStandardizedRole(s);
      if (r !== null) {
        expect(ALLOWED_STANDARDIZED_ROLES).toContain(r);
      }
    }
  });
});

describe('normalizeEmail', () => {
  it('lowercases', () => {
    expect(normalizeEmail('Jane.Doe@INDUSTRIOUSOFFICE.COM')).toBe('jane.doe@industriousoffice.com');
  });

  it('trims whitespace', () => {
    expect(normalizeEmail('  jane@industriousoffice.com  ')).toBe('jane@industriousoffice.com');
  });

  it('is idempotent', () => {
    const once = normalizeEmail('Jane.Doe@Example.com');
    const twice = normalizeEmail(once);
    expect(twice).toBe(once);
  });

  it('handles null/undefined safely', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('isValidEmail', () => {
  it('accepts well-formed emails', () => {
    expect(isValidEmail('jane@industriousoffice.com')).toBe(true);
    expect(isValidEmail('jane.doe+tag@industriousoffice.co.uk')).toBe(true);
  });

  it('rejects malformed emails', () => {
    expect(isValidEmail('jane@')).toBe(false);
    expect(isValidEmail('@industriousoffice.com')).toBe(false);
    expect(isValidEmail('not an email')).toBe(false);
    expect(isValidEmail('jane @industriousoffice.com')).toBe(false);
    expect(isValidEmail('jane@industriousoffice')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isAllowedDomain', () => {
  it('accepts industriousoffice.com', () => {
    expect(isAllowedDomain('jane@industriousoffice.com')).toBe(true);
    expect(isAllowedDomain('foo.bar@industriousoffice.com')).toBe(true);
  });

  it('rejects other domains', () => {
    expect(isAllowedDomain('jane@gmail.com')).toBe(false);
    expect(isAllowedDomain('jane@industriousoffice.co.uk')).toBe(false); // different TLD
    expect(isAllowedDomain('jane@personalemail.com')).toBe(false);
  });

  it('rejects emails without @', () => {
    expect(isAllowedDomain('janeindustriousoffice.com')).toBe(false);
    expect(isAllowedDomain('')).toBe(false);
  });
});

describe('dedupeByEmail', () => {
  it('preserves single-occurrence rows', () => {
    const rows = [
      { email: 'a@x.com', sourceRowIndex: 4, name: 'A' },
      { email: 'b@x.com', sourceRowIndex: 5, name: 'B' },
      { email: 'c@x.com', sourceRowIndex: 6, name: 'C' },
    ];
    const { unique, duplicates } = dedupeByEmail(rows);
    expect(unique).toHaveLength(3);
    expect(duplicates).toHaveLength(0);
  });

  it('last-wins: keeps last occurrence; logs earlier as duplicate', () => {
    const rows = [
      { email: 'a@x.com', sourceRowIndex: 4, name: 'A-first' },
      { email: 'b@x.com', sourceRowIndex: 5, name: 'B' },
      { email: 'a@x.com', sourceRowIndex: 6, name: 'A-second' },
    ];
    const { unique, duplicates } = dedupeByEmail(rows);
    expect(unique).toHaveLength(2);
    expect(unique.map((r) => r.name)).toEqual(['B', 'A-second']);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].sourceRow).toBe(4);
    expect(duplicates[0].keptSourceRow).toBe(6);
    expect(duplicates[0].email).toBe('a@x.com');
  });

  it('handles all-duplicate edge case', () => {
    const rows = [
      { email: 'a@x.com', sourceRowIndex: 4, name: 'first' },
      { email: 'a@x.com', sourceRowIndex: 5, name: 'second' },
      { email: 'a@x.com', sourceRowIndex: 6, name: 'third' },
    ];
    const { unique, duplicates } = dedupeByEmail(rows);
    expect(unique).toHaveLength(1);
    expect(unique[0].name).toBe('third');
    expect(duplicates).toHaveLength(2);
    expect(duplicates.map((d) => d.sourceRow).sort()).toEqual([4, 5]);
    expect(duplicates.every((d) => d.keptSourceRow === 6)).toBe(true);
  });

  it('handles empty input', () => {
    const { unique, duplicates } = dedupeByEmail([] as Array<{ email: string; sourceRowIndex: number }>);
    expect(unique).toEqual([]);
    expect(duplicates).toEqual([]);
  });
});

describe('findManagerByName', () => {
  const directory = [
    { id: '1', name: 'Nicole Anglesey', email: 'nicole.anglesey@industriousoffice.com' },
    { id: '2', name: 'Sabrina Sanvictores', email: 'sabrina.s@industriousoffice.com' },
    { id: '3', name: 'John Smith', email: 'john.smith.1@industriousoffice.com' },
    { id: '4', name: 'John Smith', email: 'john.smith.2@industriousoffice.com' },
  ];

  it('returns single match for unique name', () => {
    const r = findManagerByName('Nicole Anglesey', directory);
    expect(r.match?.id).toBe('1');
    expect(r.ambiguous).toBe(false);
    expect(r.count).toBe(1);
  });

  it('is case-insensitive', () => {
    const r = findManagerByName('nicole anglesey', directory);
    expect(r.match?.id).toBe('1');
  });

  it('trims whitespace', () => {
    const r = findManagerByName('  Nicole Anglesey  ', directory);
    expect(r.match?.id).toBe('1');
  });

  it('returns ambiguous for multi-hit', () => {
    const r = findManagerByName('John Smith', directory);
    expect(r.match).toBeNull();
    expect(r.ambiguous).toBe(true);
    expect(r.count).toBe(2);
  });

  it('returns no-match for unknown name', () => {
    const r = findManagerByName('Nonexistent Person', directory);
    expect(r.match).toBeNull();
    expect(r.ambiguous).toBe(false);
    expect(r.count).toBe(0);
  });

  it('returns no-match for empty name', () => {
    const r = findManagerByName('', directory);
    expect(r.match).toBeNull();
    expect(r.count).toBe(0);
  });

  it('SELF-REFERENCE GUARD: same name + same email → 0 matches', () => {
    const r = findManagerByName('Nicole Anglesey', directory, 'nicole.anglesey@industriousoffice.com');
    expect(r.match).toBeNull();
    expect(r.ambiguous).toBe(false);
    expect(r.count).toBe(0);
  });

  it('SELF-REFERENCE GUARD: same name + different email → 1 match', () => {
    const r = findManagerByName('Nicole Anglesey', directory, 'someone-else@industriousoffice.com');
    expect(r.match?.id).toBe('1');
    expect(r.count).toBe(1);
  });

  it('SELF-REFERENCE GUARD: ambiguous filtered to single via selfEmail', () => {
    // Two John Smiths exist; supplying one of their emails as selfEmail
    // should leave only one candidate.
    const r = findManagerByName('John Smith', directory, 'john.smith.1@industriousoffice.com');
    expect(r.match?.id).toBe('4');
    expect(r.ambiguous).toBe(false);
    expect(r.count).toBe(1);
  });
});

describe('shouldUpdateField', () => {
  type Row = { region: string | null; provisioned?: boolean };

  it('provisioned profile + diff → true', () => {
    const existing: Row = { region: 'East', provisioned: true };
    expect(shouldUpdateField(existing, 'region', 'West')).toBe(true);
  });

  it('non-provisioned + null existing + non-null new → true (fill-in)', () => {
    const existing: Row = { region: null, provisioned: false };
    expect(shouldUpdateField(existing, 'region', 'East')).toBe(true);
  });

  it('non-provisioned + non-null existing + diff new → false (admin override preserved)', () => {
    const existing: Row = { region: 'East', provisioned: false };
    expect(shouldUpdateField(existing, 'region', 'West')).toBe(false);
  });

  it('identical values → false (no-op)', () => {
    const existing: Row = { region: 'East', provisioned: true };
    expect(shouldUpdateField(existing, 'region', 'East')).toBe(false);
  });

  it('null new value → false (cannot clear via import)', () => {
    const existing: Row = { region: 'East', provisioned: true };
    expect(shouldUpdateField(existing, 'region', null)).toBe(false);
  });

  it('empty-string new value → false (cannot clear via import)', () => {
    const existing: Row = { region: 'East', provisioned: true };
    expect(shouldUpdateField(existing, 'region', '')).toBe(false);
  });

  it('provisioned undefined treated as not-provisioned', () => {
    const existing: Row = { region: 'East' };
    expect(shouldUpdateField(existing, 'region', 'West')).toBe(false); // existing non-null, no provisioned flag
  });
});
