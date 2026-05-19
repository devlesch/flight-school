import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

/**
 * Get the current user's profile
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }

  return data as Profile;
}

/**
 * Get a profile by user ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }

  return data as Profile;
}

/**
 * Get a profile by exact name (case-insensitive).
 *
 * NOTE: the `profiles` table column is `name` (NOT `full_name`). We use
 * Supabase's `ilike` operator for a case-insensitive exact match, mirroring
 * the error-swallowing behavior of `getProfile` (log → return null).
 *
 * Empty/whitespace input short-circuits with `null` — no Supabase call.
 */
export async function getProfileByName(name: string): Promise<Profile | null> {
  if (!name || !name.trim()) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('name', name)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile by name:', error.message);
    return null;
  }

  return (data as Profile | null) ?? null;
}

/**
 * Update a profile
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Profile>
): Promise<Profile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error.message);
    return null;
  }

  return data as Profile;
}

/**
 * Update the current user's profile
 */
export async function updateCurrentProfile(
  updates: Partial<Profile>
): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return updateProfile(user.id, updates);
}

/**
 * Delete a profile by user ID
 */
export async function deleteProfile(userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('Error deleting profile:', error.message);
    return false;
  }

  return true;
}
