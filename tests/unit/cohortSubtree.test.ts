import { describe, it, expect } from 'vitest';
import { getCohortMembersForManager } from '../../services/cohortService';
import type { Profile } from '../../types/database';

/**
 * Task 1 harness — minimum reproducible test for the `9bd1fe1` precedent
 * (replace a stored-`role` filter with a derived-attribute check) and the
 * latent direct-reports bug (`.eq('role','New Hire')` at cohortService.ts:~329).
 *
 * This uses an INJECTED in-memory Supabase client (the new optional `client?`
 * param on `getCohortMembersForManager`) — NOT a real Supabase connection.
 * The fake covers exactly the query chain the function calls.
 */

// --- In-memory fixture tables ---
interface Tables {
  profiles: Profile[];
  cohorts: Record<string, unknown>[];
  cohort_leaders: Record<string, unknown>[];
  training_modules: Record<string, unknown>[];
  user_modules: Record<string, unknown>[];
}

/**
 * Hand-written stub implementing the `.from().select().eq()...` chain shape
 * that `getCohortMembersForManager` calls. Each chain method records its
 * predicate; the chain is thenable so `await`-ing it returns `{ data, error }`.
 *
 * Supported terminal/await methods: `.order()`, `.in()`, `.single()`, and the
 * chain itself (await directly). Supported filters: `.eq` (incl. embedded
 * `profiles.email` for the cohort_leaders join), `.gte`, `.lte`, `.not`, `.is`.
 */
function makeFakeClient(tables: Tables) {
  function query(table: keyof Tables) {
    let rows: Record<string, unknown>[] = [...(tables[table] as Record<string, unknown>[])];
    let selectStr = '*';

    const builder: Record<string, unknown> = {
      select(s: string) {
        selectStr = s;
        return builder;
      },
      eq(col: string, val: unknown) {
        if (col === 'profiles.email') {
          // cohort_leaders join: filter by the embedded profile's email.
          rows = rows.filter((r) => {
            const pid = r.profile_id as string;
            const p = tables.profiles.find((pp) => pp.id === pid);
            return p?.email === val;
          });
        } else {
          rows = rows.filter((r) => r[col] === val);
        }
        return builder;
      },
      gte(col: string, val: unknown) {
        rows = rows.filter((r) => r[col] != null && (r[col] as string) >= (val as string));
        return builder;
      },
      lte(col: string, val: unknown) {
        rows = rows.filter((r) => r[col] != null && (r[col] as string) <= (val as string));
        return builder;
      },
      not(col: string, _op: string, val: unknown) {
        // Only `.not('start_date','is',null)` is used.
        if (val === null) rows = rows.filter((r) => r[col] != null);
        return builder;
      },
      is(col: string, val: unknown) {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        rows = rows.filter((r) => (vals as unknown[]).includes(r[col]));
        return Promise.resolve({ data: embed(rows), error: null });
      },
      order() {
        return Promise.resolve({ data: embed(rows), error: null });
      },
      single() {
        return Promise.resolve({ data: embed(rows)[0] ?? null, error: null });
      },
      then(resolve: (v: { data: unknown; error: null }) => unknown) {
        return Promise.resolve({ data: embed(rows), error: null }).then(resolve);
      },
    };

    // Resolve embedded relations requested in the select string
    // (e.g. `*, cohorts(*)`, `*, profiles(*)`, `profiles!inner(email)`).
    function embed(input: Record<string, unknown>[]): Record<string, unknown>[] {
      if (table !== 'cohort_leaders') return input;
      const wantCohorts = /cohorts\s*\(/.test(selectStr);
      const wantProfiles = /profiles[!\w]*\s*\(/.test(selectStr);
      return input.map((r) => {
        const out: Record<string, unknown> = { ...r };
        if (wantCohorts) {
          out.cohorts = tables.cohorts.find((c) => c.id === r.cohort_id) ?? null;
        }
        if (wantProfiles) {
          out.profiles = tables.profiles.find((p) => p.id === r.profile_id) ?? null;
        }
        return out;
      });
    }

    return builder;
  }

  // Fake of the `descendant_ids(root)` RPC (migration 023): walks `manager_id`
  // transitively below `root` and returns the full descendant id closure.
  // Mirrors the server function — cycle-guarded, so it terminates on cycles.
  function rpc(fn: string, args: Record<string, unknown>) {
    if (fn !== 'descendant_ids') {
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });
    }
    const root = args.root as string;
    const ids: string[] = [];
    const seen = new Set<string>([root]);
    let frontier = [root];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const parent of frontier) {
        for (const p of tables.profiles) {
          if (p.manager_id === parent && !seen.has(p.id)) {
            seen.add(p.id);
            ids.push(p.id);
            next.push(p.id);
          }
        }
      }
      frontier = next;
    }
    return Promise.resolve({ data: ids, error: null });
  }

  return {
    from: (t: keyof Tables) => query(t),
    rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
  } as never;
}

// --- Profile factory ---
function profile(over: Partial<Profile> & { id: string }): Profile {
  return {
    id: over.id,
    email: over.email ?? `${over.id}@industriousoffice.com`,
    name: over.name ?? over.id,
    role: over.role ?? 'New Hire',
    is_admin: over.is_admin ?? false,
    is_manager_override: over.is_manager_override ?? false,
    avatar: null,
    title: over.title ?? null,
    region: over.region ?? null,
    location: null,
    standardized_role: over.standardized_role ?? null,
    manager_id: over.manager_id ?? null,
    department: null,
    start_date: over.start_date ?? null,
    provisioned: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('getCohortMembersForManager — 9bd1fe1 precedent + latent direct-reports bug', () => {
  // ===========================================================================
  // (a) 9bd1fe1 precedent: cohort-slot membership is derived from
  //     standardized_role + region + start_date — NOT from the stored `role`.
  //     A Manager-role profile that matches a cohort slot must still appear.
  // ===========================================================================
  it('includes a Manager-role profile in the cohort member list when standardized_role + region + start_date match the slot (no .eq(role) on the cohort-slot query)', async () => {
    const cohort = {
      id: 'cohort-1',
      name: 'Spring 2026',
      hire_start_date: '2026-03-01',
      hire_end_date: '2026-03-31',
      starting_date: '2026-03-15',
      created_at: '2026-01-01T00:00:00Z',
    };

    // The manager leads the MxA slot in the North East region.
    const gm = profile({ id: 'gm-1', role: 'Manager', standardized_role: 'MxM', region: 'North East' });

    // This member has role='Manager' (stored role lies) but its
    // standardized_role + region + start_date land it inside the MxA slot.
    const managerInCohort = profile({
      id: 'mgr-in-cohort',
      role: 'Manager',
      standardized_role: 'MxA',
      region: 'North East',
      start_date: '2026-03-10',
    });

    const client = makeFakeClient({
      profiles: [gm, managerInCohort],
      cohorts: [cohort],
      cohort_leaders: [
        {
          id: 'cl-1',
          cohort_id: 'cohort-1',
          role_label: 'MxA',
          region: 'North East',
          profile_id: 'gm-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      training_modules: [],
      user_modules: [],
    });

    const result = await getCohortMembersForManager('gm-1', client);

    expect(result).not.toBeNull();
    const memberIds = result!.members.map((m) => m.profile.id);
    // The Manager-role profile is present BECAUSE the cohort-slot query filters
    // on standardized_role + region + start_date, never on `role`.
    expect(memberIds).toContain('mgr-in-cohort');
  });

  // ===========================================================================
  // (b) GREEN-FOR-THE-FIX — Task 3 removed `.eq('role','New Hire')` from the
  //     direct-reports query and replaced the single-level fetch with the
  //     transitive `descendant_ids` RPC walk.
  //
  //     A Manager who reports to a GM (role='Manager', manager_id=<gm id>) now
  //     APPEARS in that GM's overview — previously hidden by the stale filter.
  // ===========================================================================
  it('a Manager who reports to a GM IS present in the GM overview (the .eq(role, New Hire) direct-reports filter was removed)', async () => {
    const gm = profile({ id: 'gm-2', role: 'Manager', name: 'GM Two' });

    // A real Manager reporting up to the GM. role='Manager', manager_id=gm-2.
    const subManager = profile({
      id: 'sub-manager',
      role: 'Manager',
      name: 'Sub Manager',
      manager_id: 'gm-2',
    });

    // A normal new hire reporting to the same GM.
    const newHire = profile({
      id: 'new-hire',
      role: 'New Hire',
      name: 'New Hire',
      manager_id: 'gm-2',
    });

    const client = makeFakeClient({
      profiles: [gm, subManager, newHire],
      cohorts: [],
      cohort_leaders: [],
      training_modules: [],
      user_modules: [],
    });

    const result = await getCohortMembersForManager('gm-2', client);

    expect(result).not.toBeNull();
    const memberIds = result!.members.map((m) => m.profile.id);

    // The new hire shows up...
    expect(memberIds).toContain('new-hire');
    // ...and the sub-manager is now visible too (no `.eq('role','New Hire')`).
    expect(memberIds).toContain('sub-manager');
    // The sub-manager is a depth-1 direct report — tagged 'direct'.
    expect(result!.members.find((m) => m.profile.id === 'sub-manager')?.source).toBe('direct');
  });

  // ===========================================================================
  // (c) DEPTH ≥ 2 — the transitive walk reaches nested reports.
  //     GM → MXM → MxA: the MxA is two levels below the GM and must appear
  //     in the GM's overview, tagged 'subtree' (a sub-manager / nested report).
  // ===========================================================================
  it('a depth-≥2 transitive member (GM → MXM → MxA) appears in the GM overview tagged as subtree', async () => {
    const gm = profile({ id: 'gm-3', role: 'Manager', name: 'GM Three' });

    // Level 1: an MXM reporting directly to the GM.
    const mxm = profile({
      id: 'mxm-1',
      role: 'Manager',
      name: 'MXM One',
      manager_id: 'gm-3',
    });

    // Level 2: an MxA reporting to the MXM — two levels below the GM.
    const mxa = profile({
      id: 'mxa-1',
      role: 'New Hire',
      name: 'MxA One',
      manager_id: 'mxm-1',
    });

    const client = makeFakeClient({
      profiles: [gm, mxm, mxa],
      cohorts: [],
      cohort_leaders: [],
      training_modules: [],
      user_modules: [],
    });

    const result = await getCohortMembersForManager('gm-3', client);

    expect(result).not.toBeNull();
    const memberIds = result!.members.map((m) => m.profile.id);

    // The depth-1 MXM and the depth-2 MxA are both pulled in by the walk.
    expect(memberIds).toContain('mxm-1');
    expect(memberIds).toContain('mxa-1');
    // The depth-2 MxA is tagged 'subtree' (transitive, not a direct report).
    expect(result!.members.find((m) => m.profile.id === 'mxa-1')?.source).toBe('subtree');
  });
});
