import { supabase } from '../lib/supabase';
import type { Cohort, CohortInsert, CohortUpdate, CohortLeaderInsert, CohortWithLeaders, CohortLeader, Profile, TrainingModule, UserModule } from '../types/database';

// --- Manager Cohort Data Types ---

export interface UserModuleWithDetails {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  type: string;
  duration: string;
  completed: boolean;
  completedAt: string | null;
  dueDate: string;
  link: string | null;
  host: string | null;
}

export interface CohortMember {
  profile: Profile;
  progress: number;
  modules: UserModuleWithDetails[];
}

export interface ManagerCohortData {
  cohort: Cohort;
  members: CohortMember[];
  leaders: { leader: CohortLeader; profile: Profile }[];
}

/**
 * Maps each cohort leader slot to the standardized_role values eligible to lead it:
 *   MxA → MxM
 *   MxM → AGM or GM
 *   AGM → GM or RD
 *   GM  → RD
 */
export const LEADER_ROLE_MAP: Record<string, string[]> = {
  MxA: ['MxA', 'MxM'],
  MxM: ['MxM', 'AGM', 'GM'],
  AGM: ['AGM', 'GM', 'RD'],
  GM: ['GM', 'RD'],
};

/**
 * Get all cohorts ordered by hire_start_date DESC
 */
export async function getCohorts(): Promise<Cohort[]> {
  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .order('hire_start_date', { ascending: false });

  if (error) {
    console.error('Error fetching cohorts:', error.message);
    return [];
  }

  return data as Cohort[];
}

/**
 * Get all cohorts with embedded leaders and their profiles
 */
export async function getCohortsWithLeaders(): Promise<CohortWithLeaders[]> {
  const { data, error } = await supabase
    .from('cohorts')
    .select('*, cohort_leaders(*, profiles(*))')
    .order('hire_start_date', { ascending: false });

  if (error) {
    console.error('Error fetching cohorts with leaders:', error.message);
    return [];
  }

  return data as CohortWithLeaders[];
}

/**
 * Create a cohort with its leaders
 */
export async function createCohort(
  data: CohortInsert,
  leaders: Omit<CohortLeaderInsert, 'cohort_id'>[]
): Promise<Cohort | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cohort, error: cohortError } = await (supabase as any)
    .from('cohorts')
    .insert(data)
    .select()
    .single();

  if (cohortError) {
    console.error('Error creating cohort:', cohortError.message);
    return null;
  }

  const created = cohort as Cohort;

  if (leaders.length > 0) {
    const leaderRows = leaders.map(l => ({ ...l, cohort_id: created.id }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: leadersError } = await (supabase as any)
      .from('cohort_leaders')
      .insert(leaderRows);

    if (leadersError) {
      console.error('Error creating cohort leaders:', leadersError.message);
    }
  }

  return created;
}

/**
 * Upsert a leader assignment for a cohort slot
 */
export async function upsertCohortLeader(
  cohortId: string, roleLabel: string, region: string, profileId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('cohort_leaders')
    .upsert(
      { cohort_id: cohortId, role_label: roleLabel, region, profile_id: profileId },
      { onConflict: 'cohort_id,role_label,region' }
    );

  if (error) {
    console.error('Error upserting cohort leader:', error.message);
    return false;
  }

  return true;
}

/**
 * Update a cohort's fields by ID
 */
export async function updateCohort(
  id: string,
  data: CohortUpdate
): Promise<Cohort | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from('cohorts')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateCohort error:', error);
    return null;
  }

  return updated as Cohort;
}

/**
 * Delete a cohort (CASCADE handles leaders)
 */
export async function deleteCohort(cohortId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('cohorts')
    .delete()
    .eq('id', cohortId);

  if (error) {
    console.error('Error deleting cohort:', error.message);
    return false;
  }

  return true;
}

/**
 * Check if a user is a cohort leader (by profile_id or email fallback)
 */
export async function isUserCohortLeader(userId: string): Promise<boolean> {
  // Direct match
  const { data: direct } = await supabase
    .from('cohort_leaders')
    .select('id')
    .eq('profile_id', userId)
    .limit(1);

  if (direct && direct.length > 0) return true;

  // Email fallback for provisioned ID mismatch
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  if (profile?.email) {
    const { data: emailMatch } = await supabase
      .from('cohort_leaders')
      .select('id, profiles!inner(email)')
      .eq('profiles.email', profile.email)
      .limit(1);

    if (emailMatch && emailMatch.length > 0) return true;
  }

  return false;
}

/**
 * Get a manager's cohort with enriched member data.
 * Resolves: manager → cohort_leaders → cohort (most recent) → profiles by date range → user_modules + training_modules
 */
export async function getCohortMembersForManager(managerId: string): Promise<ManagerCohortData | null> {
  // 1. Find cohorts this manager leads (by profile_id directly, or by email match for provisioned profiles)
  const { data: leaderRows, error: leaderError } = await supabase
    .from('cohort_leaders')
    .select('*, cohorts(*)')
    .eq('profile_id', managerId);

  // If no direct match, try matching via email (handles provisioned ID mismatch)
  let resolvedLeaderRows = leaderRows;
  if ((!leaderRows || leaderRows.length === 0) && !leaderError) {
    // Get this manager's email
    const { data: managerProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', managerId)
      .single();

    if (managerProfile?.email) {
      // Find cohort_leaders whose linked profile has the same email
      const { data: emailMatch, error: emailError } = await supabase
        .from('cohort_leaders')
        .select('*, cohorts(*), profiles!inner(email)')
        .eq('profiles.email', managerProfile.email);

      resolvedLeaderRows = emailMatch;
    }
  }

  if (leaderError || !resolvedLeaderRows || resolvedLeaderRows.length === 0) {
    if (leaderError) console.error('Error fetching cohort leaders:', leaderError.message);
    return null;
  }

  // 2. Pick the most recent cohort by hire_start_date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withCohort = resolvedLeaderRows.filter((r: any) => r.cohorts);
  if (withCohort.length === 0) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withCohort.sort((a: any, b: any) =>
    new Date(b.cohorts.hire_start_date).getTime() - new Date(a.cohorts.hire_start_date).getTime()
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cohort = (withCohort[0] as any).cohorts as Cohort;
  // 3. Get all leaders for this cohort (with profiles)
  const { data: allLeaders, error: leadersError } = await supabase
    .from('cohort_leaders')
    .select('*, profiles(*)')
    .eq('cohort_id', cohort.id);

  if (leadersError) {
    console.error('Error fetching all cohort leaders:', leadersError.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leaders = (allLeaders || []).map((row: any) => ({
    leader: { id: row.id, cohort_id: row.cohort_id, role_label: row.role_label, region: row.region, profile_id: row.profile_id, created_at: row.created_at } as CohortLeader,
    profile: row.profiles as Profile,
  }));

  // 4. Get cohort members: profiles where start_date is within cohort date range and role = 'New Hire'
  const { data: memberProfiles, error: membersError } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'New Hire')
    .gte('start_date', cohort.hire_start_date)
    .lte('start_date', cohort.hire_end_date)
    .not('start_date', 'is', null)
    .order('name', { ascending: true });

  if (membersError) {
    console.error('Error fetching cohort members:', membersError.message);
    return { cohort, members: [], leaders };
  }

  const profiles = (memberProfiles || []) as Profile[];
  if (profiles.length === 0) {
    return { cohort, members: [], leaders };
  }

  // 5. Get all training modules
  const { data: trainingModules } = await supabase
    .from('training_modules')
    .select('*')
    .order('sort_order', { ascending: true });

  const allModules = (trainingModules || []) as TrainingModule[];

  // 6. Get user_modules for all members in batch
  const memberIds = profiles.map(p => p.id);
  const { data: userModulesData } = await supabase
    .from('user_modules')
    .select('*')
    .in('user_id', memberIds);

  const allUserModules = (userModulesData || []) as UserModule[];

  // Group user_modules by user_id
  const modulesByUser = new Map<string, UserModule[]>();
  for (const um of allUserModules) {
    const existing = modulesByUser.get(um.user_id) || [];
    existing.push(um);
    modulesByUser.set(um.user_id, existing);
  }

  // Compute due date baseline
  const startingDate = cohort.starting_date || cohort.hire_start_date;

  // 7. Build enriched members
  const members: CohortMember[] = profiles.map(profile => {
    const userModules = modulesByUser.get(profile.id) || [];
    const progressMap = new Map(userModules.map(um => [um.module_id, um]));

    const completedCount = userModules.filter(um => um.completed).length;
    const progress = allModules.length > 0 ? Math.round((completedCount / allModules.length) * 100) : 0;

    const modules: UserModuleWithDetails[] = allModules.map(mod => {
      const userMod = progressMap.get(mod.id);
      const dueDate = new Date(new Date(startingDate + 'T00:00:00').getTime() + (mod.day_offset ?? 0) * 86400000)
        .toISOString().split('T')[0];

      return {
        id: userMod?.id || mod.id,
        moduleId: mod.id,
        title: mod.title,
        description: mod.description || '',
        type: mod.type,
        duration: mod.duration || '',
        completed: userMod?.completed || false,
        completedAt: userMod?.completed_at || null,
        dueDate,
        link: mod.link || null,
        host: mod.host || null,
      };
    });

    return { profile, progress, modules };
  });

  return { cohort, members, leaders };
}
