import { supabase } from '../lib/supabase';
import type { Okr, KeyResult, UserOkr } from '../types/database';

export interface OkrWithKeyResults extends Okr {
  key_results: KeyResult[];
}

/**
 * Get all OKRs with their key results
 */
export async function getOkrs(): Promise<OkrWithKeyResults[]> {
  const { data: okrs, error: okrsError } = await supabase
    .from('okrs')
    .select('*')
    .order('created_at', { ascending: true });

  if (okrsError) {
    console.error('Error fetching OKRs:', okrsError.message);
    return [];
  }

  if (!okrs || okrs.length === 0) {
    return [];
  }

  // Get all key results
  const okrIds = (okrs as Okr[]).map(o => o.id);
  const { data: keyResults, error: krError } = await supabase
    .from('key_results')
    .select('*')
    .in('okr_id', okrIds)
    .order('sort_order', { ascending: true });

  if (krError) {
    console.error('Error fetching key results:', krError.message);
    return (okrs as Okr[]).map(o => ({ ...o, key_results: [] }));
  }

  // Group key results by OKR
  const krByOkr = new Map<string, KeyResult[]>();
  (keyResults || []).forEach(kr => {
    const existing = krByOkr.get(kr.okr_id) || [];
    existing.push(kr as KeyResult);
    krByOkr.set(kr.okr_id, existing);
  });

  return (okrs as Okr[]).map(okr => ({
    ...okr,
    key_results: krByOkr.get(okr.id) || [],
  }));
}

/**
 * Get OKRs assigned to a specific user
 */
export async function getUserOkrs(userId: string): Promise<OkrWithKeyResults[]> {
  // Get user's OKR assignments
  const { data: assignments, error: assignError } = await supabase
    .from('user_okrs')
    .select('okr_id')
    .eq('user_id', userId);

  if (assignError) {
    console.error('Error fetching user OKR assignments:', assignError.message);
    return [];
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  const okrIds = (assignments as UserOkr[]).map(a => a.okr_id);

  // Get the actual OKRs
  const { data: okrs, error: okrsError } = await supabase
    .from('okrs')
    .select('*')
    .in('id', okrIds);

  if (okrsError) {
    console.error('Error fetching OKRs:', okrsError.message);
    return [];
  }

  if (!okrs || okrs.length === 0) {
    return [];
  }

  // Get key results for these OKRs
  const { data: keyResults, error: krError } = await supabase
    .from('key_results')
    .select('*')
    .in('okr_id', okrIds)
    .order('sort_order', { ascending: true });

  if (krError) {
    console.error('Error fetching key results:', krError.message);
    return (okrs as Okr[]).map(o => ({ ...o, key_results: [] }));
  }

  // Group key results by OKR
  const krByOkr = new Map<string, KeyResult[]>();
  (keyResults || []).forEach(kr => {
    const existing = krByOkr.get(kr.okr_id) || [];
    existing.push(kr as KeyResult);
    krByOkr.set(kr.okr_id, existing);
  });

  return (okrs as Okr[]).map(okr => ({
    ...okr,
    key_results: krByOkr.get(okr.id) || [],
  }));
}

/**
 * Assign an OKR to a user
 */
export async function assignOkrToUser(userId: string, okrId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_okrs')
    .insert({ user_id: userId, okr_id: okrId });

  if (error) {
    console.error('Error assigning OKR:', error.message);
    return false;
  }

  return true;
}
