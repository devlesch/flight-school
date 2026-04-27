import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import {
  parseRegionColumn,
  inferRegionFromLocation,
  inferRegionFromState,
  inferStandardizedRole,
  normalizeEmail,
  findManagerByName,
  shouldUpdateField,
  type Region,
  type StandardizedRole,
} from './userImportMappers';

export interface WorkdayRow {
  // Source tracking — 1-based row in the source file (header counted, matches Excel/Sheets)
  sourceRowIndex: number;
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
  hubLocation: string;       // preferred over location for region inference
  stateProvince: string;     // last-resort region inference
  rawRegion: string;         // verbatim Region column value
  department: string;
  email: string;
  // Derived (populated during parse via userImportMappers)
  region: Region | null;
  regionSource: 'column' | 'inferred' | null;
  standardizedRole: StandardizedRole | null;
}

export interface ImportResult {
  // Existing counts (kept for backwards compatibility with current UI)
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  managersCreated: number;
  details: string[];
  // Region telemetry
  regionPopulated: number;
  regionFromColumn: number;
  regionFromInference: number;
  regionUnmapped: number;
  // Standardized-role telemetry
  standardizedRolePopulated: number;
  standardizedRoleNotApplicable: number;
  // Manager-linkage diagnostics
  managersLinked: number;
  unmappedManager: Array<{ sourceRow: number; managerName: string }>;
  ambiguousManager: Array<{ sourceRow: number; managerName: string; matchCount: number }>;
  selfReferenceManager: Array<{ sourceRow: number; email: string; via: 'email' | 'name' }>;
}

// Known Workday column header patterns mapped to WorkdayRow fields.
// Each entry: [field, ...possible header substrings (lowercase)]
// Column patterns are checked in order. More specific patterns are listed first
// to avoid ambiguous matches (e.g., "manager first name" before "first name").
const COLUMN_PATTERNS: [keyof WorkdayRow, string[]][] = [
  ['managerFirstName', ['manager first name', 'supervisor first name', "manager's first"]],
  ['managerLastName', ['manager last name', 'supervisor last name', "manager's last"]],
  ['managerEmail', ['manager email', 'supervisor email', "manager's email", "manager's work email"]],
  ['managerName', ['manager', 'supervisor', 'superior', 'reports to']],
  ['firstName', ['legal name - first name', 'preferred name - first name', 'first name', 'given name']],
  ['lastName', ['legal name - last name', 'last name', 'family name', 'surname']],
  ['workerName', ['full name', 'worker', 'employee name']],
  ['hireDate', ['hire date', 'start date', 'date of hire', 'original hire']],
  ['terminationDate', ['termination', 'end date', 'term date']],
  // 'title' (bare) is intentionally last in this field's pattern list so
  // 'business title' / 'job title' / 'position title' match first when present.
  ['businessTitle', ['business title', 'job title', 'job profile', 'position title', 'title']],
  // HUB Location detected before Location so 'hub location' wins over the bare 'location' substring match.
  ['hubLocation', ['hub location', 'hub']],
  ['location', ['work location', 'office', 'site', 'location']],
  ['stateProvince', ['state/province', 'state', 'province']],
  ['rawRegion', ['region']],
  ['department', ['department', 'cost center', 'org unit', 'supervisory']],
  ['email', ['email - primary work', 'primary work email', 'work email', 'email address', 'worker email', 'primary email', 'email']],
];

/**
 * Finds the header row by scanning for rows that contain multiple known column names.
 * Returns the 0-based row index and a mapping from field name to column index.
 */
function detectHeaderRow(allRows: unknown[][]): { headerIndex: number; columnMap: Map<keyof WorkdayRow, number> } | null {
  // Scan the first 20 rows looking for the header
  const scanLimit = Math.min(allRows.length, 20);

  let bestMatch: { headerIndex: number; columnMap: Map<keyof WorkdayRow, number>; score: number } | null = null;

  for (let rowIdx = 0; rowIdx < scanLimit; rowIdx++) {
    const row = allRows[rowIdx];
    if (!row || !Array.isArray(row)) continue;

    const headers = row.map(cell => String(cell || '').toLowerCase().trim());
    const columnMap = new Map<keyof WorkdayRow, number>();

    for (const [field, patterns] of COLUMN_PATTERNS) {
      // Already found this field? Skip (first match wins for duplicate-ish patterns like "name")
      if (columnMap.has(field)) continue;

      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const h = headers[colIdx];
        if (!h) continue;
        // Check if any pattern matches as a substring of the header
        if (patterns.some(p => h.includes(p))) {
          // Avoid mapping the same column to multiple fields - prefer more specific matches
          const alreadyUsed = [...columnMap.values()].includes(colIdx);
          if (!alreadyUsed) {
            columnMap.set(field, colIdx);
            break;
          }
        }
      }
    }

    // We need at least an email column and a few others to consider this a valid header
    const score = columnMap.size;
    if (score >= 3 && columnMap.has('email') && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { headerIndex: rowIdx, columnMap, score };
    }
  }

  return bestMatch;
}

/**
 * Parse a date value from a cell (could be Date object, string, or number).
 */
function parseDateCell(cell: unknown): string | null {
  if (!cell) return null;
  if (cell instanceof Date) {
    return cell.toISOString().split('T')[0];
  }
  const s = String(cell).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Parse a Workday Excel file into structured rows.
 * Auto-detects the header row by scanning for known column names.
 * Dynamically imports xlsx to avoid bloating the bundle for non-admin users.
 */
export async function parseWorkdayExcel(file: File): Promise<WorkdayRow[]> {
  const XLSX = await import('xlsx');

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Workday exports often have an incorrect dimension tag (e.g. "A1:A1")
  // that causes xlsx to only read the first cell. Fix by recalculating the
  // actual range from all cell keys in the sheet.
  const cellKeys = Object.keys(sheet).filter(k => !k.startsWith('!'));
  if (cellKeys.length > 1) {
    const newRef = cellKeys.reduce((range, key) => {
      const decoded = XLSX.utils.decode_cell(key);
      const currentRange = range ? XLSX.utils.decode_range(range) : { s: decoded, e: decoded };
      currentRange.s.r = Math.min(currentRange.s.r, decoded.r);
      currentRange.s.c = Math.min(currentRange.s.c, decoded.c);
      currentRange.e.r = Math.max(currentRange.e.r, decoded.r);
      currentRange.e.c = Math.max(currentRange.e.c, decoded.c);
      return XLSX.utils.encode_range(currentRange);
    }, '');
    if (newRef && newRef !== sheet['!ref']) {
      console.log(`[Workday Import] Fixed sheet range: ${sheet['!ref']} -> ${newRef}`);
      sheet['!ref'] = newRef;
    }
  }

  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (allRows.length === 0) {
    throw new Error('The spreadsheet appears to be empty.');
  }

  // Auto-detect header row
  const detection = detectHeaderRow(allRows);

  if (!detection) {
    // Provide diagnostic info to help debug
    const sampleHeaders = allRows.slice(0, 10).map((r, i) =>
      `Row ${i + 1}: ${(r as unknown[]).slice(0, 8).map(c => String(c || '').substring(0, 30)).join(' | ')}`
    ).join('\n');
    throw new Error(
      `Could not detect column headers in the spreadsheet. Looked for columns like "Work Email", "First Name", "Business Title", etc.\n\nFirst rows found:\n${sampleHeaders}`
    );
  }

  const { headerIndex, columnMap } = detection;
  const dataRows = allRows.slice(headerIndex + 1);

  console.log(`[Workday Import] Header detected at row ${headerIndex + 1}. Mapped columns:`,
    Object.fromEntries([...columnMap.entries()].map(([k, v]) => [k, `col ${v} ("${String((allRows[headerIndex] as unknown[])[v] || '')}")`]))
  );

  const getCell = (row: unknown[], field: keyof WorkdayRow): string => {
    const colIdx = columnMap.get(field);
    if (colIdx === undefined) return '';
    return String(row[colIdx] || '').trim();
  };

  const rows: WorkdayRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || !Array.isArray(row)) continue;
    // Skip empty rows
    const nonEmpty = row.filter(c => c !== '' && c != null);
    if (nonEmpty.length < 3) continue;

    const email = getCell(row, 'email');
    const businessTitle = getCell(row, 'businessTitle');
    const department = getCell(row, 'department');
    const workerName = getCell(row, 'workerName');
    const firstName = getCell(row, 'firstName');
    const lastName = getCell(row, 'lastName');
    const location = getCell(row, 'location');
    const hubLocation = getCell(row, 'hubLocation');
    const stateProvince = getCell(row, 'stateProvince');
    const rawRegion = getCell(row, 'rawRegion');
    const managerName = getCell(row, 'managerName');
    const managerFirstName = getCell(row, 'managerFirstName');
    const managerLastName = getCell(row, 'managerLastName');
    const managerEmail = getCell(row, 'managerEmail');

    const hireDateIdx = columnMap.get('hireDate');
    const hireDate = hireDateIdx !== undefined ? parseDateCell(row[hireDateIdx]) : null;

    const termDateIdx = columnMap.get('terminationDate');
    const terminationDateRaw = termDateIdx !== undefined ? String(row[termDateIdx] || '').trim() : '';

    // Filter: skip terminated workers
    if (workerName.toLowerCase().includes('terminated')) continue;
    if (terminationDateRaw.length > 0) continue;

    // Filter: must have email; relax department/title requirements
    if (!email) continue;

    // Region resolution cascade: column → location keyword → state lookup
    let region: Region | null = parseRegionColumn(rawRegion);
    let regionSource: 'column' | 'inferred' | null = region ? 'column' : null;
    if (!region) {
      region = inferRegionFromLocation(hubLocation || location);
      if (region) regionSource = 'inferred';
    }
    if (!region) {
      region = inferRegionFromState(stateProvince);
      if (region) regionSource = 'inferred';
    }

    const standardizedRole = inferStandardizedRole(businessTitle);

    // sourceRowIndex: 1-based, header row counted (matches Excel/Sheets row numbers)
    // headerIndex is 0-based; header is at headerIndex+1 in 1-based terms; data row at i is at headerIndex+1+i+1.
    const sourceRowIndex = headerIndex + 2 + i;

    rows.push({
      sourceRowIndex,
      workerName: workerName || `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      hireDate,
      terminationDate: terminationDateRaw || null,
      managerName,
      managerFirstName,
      managerLastName,
      managerEmail,
      businessTitle,
      location,
      hubLocation,
      stateProvince,
      rawRegion,
      department,
      email,
      region,
      regionSource,
      standardizedRole,
    });
  }

  return rows;
}

/**
 * Import parsed Workday data into Supabase profiles.
 * Pass 1: Fetch existing profiles.
 * Pass 2: Process managers first (create/upgrade).
 * Pass 3: Process workers (create/update).
 */
export async function importWorkdayData(rows: WorkdayRow[]): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    managersCreated: 0,
    details: [],
    regionPopulated: 0,
    regionFromColumn: 0,
    regionFromInference: 0,
    regionUnmapped: 0,
    standardizedRolePopulated: 0,
    standardizedRoleNotApplicable: 0,
    managersLinked: 0,
    unmappedManager: [],
    ambiguousManager: [],
    selfReferenceManager: [],
  };

  // Accumulate region/role telemetry across all parsed rows.
  for (const row of rows) {
    if (row.region) {
      result.regionPopulated++;
      if (row.regionSource === 'column') result.regionFromColumn++;
      else if (row.regionSource === 'inferred') result.regionFromInference++;
    } else {
      result.regionUnmapped++;
    }
    if (row.standardizedRole) result.standardizedRolePopulated++;
    else result.standardizedRoleNotApplicable++;
  }

  // Pass 1a: Fetch all existing profiles, build email -> profile map.
  // Note: full-table fetch is acceptable for current scale (hundreds-low-thousands of profiles).
  // Per-batch keyed prefetch with chunking is a follow-up optimization.
  const { data: existingProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('*');

  if (fetchError) {
    result.errors.push(`Failed to fetch existing profiles: ${fetchError.message}`);
    return result;
  }

  const existingProfilesList = (existingProfiles || []) as Profile[];

  const profilesByEmail = new Map<string, Profile>();
  for (const p of existingProfilesList) {
    profilesByEmail.set(p.email.toLowerCase(), p);
  }

  // Pass 1b: Build directory used for name-based manager lookup.
  // Reuses the existingProfiles fetch (no second query needed since we already have all profiles).
  // Email is included so findManagerByName can detect and skip self-references.
  const allProfilesByName: Array<{ id: string; name: string; email: string }> = existingProfilesList.map((p) => ({
    id: p.id,
    name: p.name || '',
    email: p.email,
  }));

  // Pass 2: Process managers first (email path).
  // Collect unique manager emails. Apply self-reference guard: a manager email
  // matching a worker's own email is dropped from the manager set and recorded.
  const managerEntries = new Map<string, { name: string; firstName: string; lastName: string; email: string }>();
  for (const row of rows) {
    if (!row.managerEmail) continue;
    const mgrEmailKey = normalizeEmail(row.managerEmail);
    const workerEmailKey = normalizeEmail(row.email);
    if (mgrEmailKey && mgrEmailKey === workerEmailKey) {
      // Self-reference via email — record once per row, skip manager creation.
      result.selfReferenceManager.push({
        sourceRow: row.sourceRowIndex,
        email: workerEmailKey,
        via: 'email',
      });
      continue;
    }
    if (mgrEmailKey && !managerEntries.has(mgrEmailKey)) {
      managerEntries.set(mgrEmailKey, {
        name: row.managerName || `${row.managerFirstName} ${row.managerLastName}`.trim(),
        firstName: row.managerFirstName,
        lastName: row.managerLastName,
        email: row.managerEmail,
      });
    }
  }

  for (const [emailKey, mgr] of managerEntries) {
    const existing = profilesByEmail.get(emailKey);

    if (existing) {
      // If exists but not a Manager, upgrade role
      if (existing.role !== 'Manager' && existing.role !== 'Admin') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase as any)
            .from('profiles')
            .update({ role: 'Manager' })
            .eq('id', existing.id);

          if (updateError) {
            result.errors.push(`Failed to upgrade ${mgr.email} to Manager: ${updateError.message}`);
          } else {
            existing.role = 'Manager';
            result.details.push(`Upgraded ${mgr.email} to Manager role`);
          }
        } catch (e) {
          result.errors.push(`Error upgrading ${mgr.email}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else {
      // Create new manager profile
      const mgrName = mgr.name || `${mgr.firstName} ${mgr.lastName}`.trim();
      const newId = crypto.randomUUID();
      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(mgr.firstName)}+${encodeURIComponent(mgr.lastName)}&background=013E3F&color=F3EEE7`;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error: insertError } = await (supabase as any)
          .from('profiles')
          .insert({
            id: newId,
            email: mgr.email,
            name: mgrName,
            role: 'Manager',
            avatar,
            provisioned: true,
          })
          .select()
          .single();

        if (insertError) {
          result.errors.push(`Failed to create manager ${mgr.email}: ${insertError.message}`);
        } else {
          profilesByEmail.set(emailKey, inserted as Profile);
          result.managersCreated++;
          result.details.push(`Created manager profile: ${mgrName} (${mgr.email})`);
        }
      } catch (e) {
        result.errors.push(`Error creating manager ${mgr.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Pass 3: Process workers
  for (const row of rows) {
    const emailKey = normalizeEmail(row.email);

    // Resolve manager_id: prefer email-keyed lookup, fall back to name-based lookup.
    let managerId: string | null = null;
    const mgrEmailKey = normalizeEmail(row.managerEmail);
    if (mgrEmailKey) {
      // Email path. Self-reference would have been caught in Pass 2; defensive check here too.
      if (mgrEmailKey !== emailKey) {
        const managerProfile = profilesByEmail.get(mgrEmailKey);
        if (managerProfile) {
          managerId = managerProfile.id;
        }
      }
    } else if (row.managerName) {
      // Name path. Use full directory; pass worker email as selfEmail so a row that
      // names itself as its own manager doesn't link.
      const lookup = findManagerByName(row.managerName, allProfilesByName, row.email);
      if (lookup.match) {
        managerId = lookup.match.id;
      } else if (lookup.ambiguous) {
        result.ambiguousManager.push({
          sourceRow: row.sourceRowIndex,
          managerName: row.managerName,
          matchCount: lookup.count,
        });
      } else {
        // Detect name-path self-reference: a worker whose existing profile has the same name.
        const own = profilesByEmail.get(emailKey);
        if (own && own.name && own.name.trim().toLowerCase() === row.managerName.trim().toLowerCase()) {
          result.selfReferenceManager.push({
            sourceRow: row.sourceRowIndex,
            email: emailKey,
            via: 'name',
          });
        } else {
          result.unmappedManager.push({
            sourceRow: row.sourceRowIndex,
            managerName: row.managerName,
          });
        }
      }
    }

    if (managerId) result.managersLinked++;

    const existing = profilesByEmail.get(emailKey);

    if (existing) {
      // Build updates using shouldUpdateField gate to protect admin-curated values
      // on non-provisioned profiles. Region and standardized_role are auto-derived
      // and follow the same gate.
      const updates: Record<string, unknown> = {};
      if (managerId && shouldUpdateField(existing, 'manager_id', managerId)) updates.manager_id = managerId;
      if (shouldUpdateField(existing, 'title', row.businessTitle)) updates.title = row.businessTitle;
      if (shouldUpdateField(existing, 'department', row.department)) updates.department = row.department;
      if (row.hireDate && shouldUpdateField(existing, 'start_date', row.hireDate)) updates.start_date = row.hireDate;
      if (shouldUpdateField(existing, 'location', row.location)) updates.location = row.location;
      if (row.region && shouldUpdateField(existing, 'region', row.region)) updates.region = row.region;
      if (row.standardizedRole && shouldUpdateField(existing, 'standardized_role', row.standardizedRole)) {
        updates.standardized_role = row.standardizedRole;
      }

      if (Object.keys(updates).length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase as any)
            .from('profiles')
            .update(updates)
            .eq('id', existing.id);

          if (updateError) {
            result.errors.push(`Failed to update ${row.email}: ${updateError.message}`);
          } else {
            Object.assign(existing, updates);
            result.updated++;
            result.details.push(`Updated ${row.workerName} (${row.email})`);
          }
        } catch (e) {
          result.errors.push(`Error updating ${row.email}: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        result.skipped++;
      }
    } else {
      // Create new worker profile — always populate region + std_role when available.
      const workerName = row.workerName || `${row.firstName} ${row.lastName}`.trim();
      const newId = crypto.randomUUID();
      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.firstName)}+${encodeURIComponent(row.lastName)}&background=013E3F&color=F3EEE7`;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error: insertError } = await (supabase as any)
          .from('profiles')
          .insert({
            id: newId,
            email: row.email,
            name: workerName,
            role: 'New Hire',
            avatar,
            title: row.businessTitle || null,
            location: row.location || null,
            manager_id: managerId,
            department: row.department || null,
            start_date: row.hireDate,
            region: row.region,
            standardized_role: row.standardizedRole,
            provisioned: true,
          })
          .select()
          .single();

        if (insertError) {
          result.errors.push(`Failed to create ${row.email}: ${insertError.message}`);
        } else {
          profilesByEmail.set(emailKey, inserted as Profile);
          // Also add to the name directory so subsequent rows in this same import can resolve them by name.
          allProfilesByName.push({ id: (inserted as Profile).id, name: workerName, email: row.email });
          result.created++;
          result.details.push(`Created worker profile: ${workerName} (${row.email})`);
        }
      } catch (e) {
        result.errors.push(`Error creating ${row.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return result;
}
