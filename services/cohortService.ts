import { supabase } from '../lib/supabase';
import type { Cohort, CohortInsert, CohortLeaderInsert, CohortWithLeaders } from '../types/database';

/**
 * Training leader dropdown filters — shows the level ABOVE the trainee role:
 *   MxA trainees → led by MxM
 *   MxM trainees → led by AGM or GM
 *   AGM trainees → led by RD
 *   GM trainees  → led by RD
 */
export const LEADER_ROLE_TITLE_PATTERNS: Record<string, (title: string) => boolean> = {
  MxA: (title) => /manager/i.test(title) && !/general manager/i.test(title) && !/assistant general manager/i.test(title),
  MxM: (title) => /assistant general manager/i.test(title) || (/general manager/i.test(title) && !/assistant/i.test(title)),
  AGM: (title) => /regional director/i.test(title) || /\bRD\b/.test(title),
  GM: (title) => /regional director/i.test(title) || /\bRD\b/.test(title),
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
