import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

export interface WorkdayRow {
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
  department: string;
  email: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  managersCreated: number;
  details: string[];
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
  ['firstName', ['first name', 'preferred name', 'given name']],
  ['lastName', ['last name', 'family name', 'surname']],
  ['workerName', ['worker', 'employee name', 'full name']],
  ['hireDate', ['hire date', 'start date', 'date of hire', 'original hire']],
  ['terminationDate', ['termination', 'end date', 'term date']],
  ['businessTitle', ['business title', 'job title', 'job profile', 'position title']],
  ['location', ['location', 'work location', 'office', 'site']],
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

  for (const row of dataRows) {
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

    rows.push({
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
      department,
      email,
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
  };

  // Pass 1: Fetch all existing profiles, build email -> profile map
  const { data: existingProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('*');

  if (fetchError) {
    result.errors.push(`Failed to fetch existing profiles: ${fetchError.message}`);
    return result;
  }

  const profilesByEmail = new Map<string, Profile>();
  for (const p of (existingProfiles || [])) {
    profilesByEmail.set(p.email.toLowerCase(), p as Profile);
  }

  // Pass 2: Process managers first
  // Collect unique manager emails
  const managerEntries = new Map<string, { name: string; firstName: string; lastName: string; email: string }>();
  for (const row of rows) {
    if (row.managerEmail && !managerEntries.has(row.managerEmail.toLowerCase())) {
      managerEntries.set(row.managerEmail.toLowerCase(), {
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
    const emailKey = row.email.toLowerCase();
    const managerProfile = row.managerEmail
      ? profilesByEmail.get(row.managerEmail.toLowerCase())
      : null;
    const managerId = managerProfile?.id || null;

    const existing = profilesByEmail.get(emailKey);

    if (existing) {
      // Check if anything needs updating
      const updates: Record<string, unknown> = {};
      if (managerId && existing.manager_id !== managerId) updates.manager_id = managerId;
      if (row.businessTitle && existing.title !== row.businessTitle) updates.title = row.businessTitle;
      if (row.department && existing.department !== row.department) updates.department = row.department;
      if (row.hireDate && existing.start_date !== row.hireDate) updates.start_date = row.hireDate;
      if (row.location && existing.location !== row.location) updates.location = row.location;

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
            // Reflect updates in local map
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
      // Create new worker profile
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
            title: row.businessTitle,
            location: row.location,
            manager_id: managerId,
            department: row.department,
            start_date: row.hireDate,
            provisioned: true,
          })
          .select()
          .single();

        if (insertError) {
          result.errors.push(`Failed to create ${row.email}: ${insertError.message}`);
        } else {
          profilesByEmail.set(emailKey, inserted as Profile);
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
