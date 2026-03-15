import { supabase } from '../lib/supabase';
import type { Cohort, CohortInsert, CohortUpdate, CohortLeaderInsert, CohortWithLeaders } from '../types/database';

/**
 * Maps each cohort leader slot to the standardized_role values eligible to lead it:
 *   MxA → MxM
 *   MxM → AGM or GM
 *   AGM → GM or RD
 *   GM  → RD
 */
export const LEADER_ROLE_MAP: Record<string, string[]> = {
  MxA: ['MxM'],
  MxM: ['AGM', 'GM'],
  AGM: ['GM', 'RD'],
  GM: ['RD'],
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
