import { supabase } from '../lib/supabase';
import type { Profile, UserModule } from '../types/database';

export interface TeamMember extends Profile {
  modules?: UserModule[];
  progress?: number; // Percentage complete
}

/**
 * Get team members (direct reports) for a manager
 */
export async function getTeamMembers(managerId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('manager_id', managerId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error.message);
    return [];
  }

  return data as Profile[];
}

/**
 * Get team members with their module progress
 */
export async function getTeamWithProgress(managerId: string): Promise<TeamMember[]> {
  // Get team members
  const members = await getTeamMembers(managerId);

  if (members.length === 0) {
    return [];
  }

  // Get all user modules for team members
  const memberIds = members.map(m => m.id);
  const { data: allModules, error: modulesError } = await supabase
    .from('user_modules')
    .select('*')
    .in('user_id', memberIds);

  if (modulesError) {
    console.error('Error fetching team modules:', modulesError.message);
    return members.map(m => ({ ...m, progress: 0 }));
  }

  // Get total module count for progress calculation
  const { count: totalModules } = await supabase
    .from('training_modules')
    .select('*', { count: 'exact', head: true });

  // Group modules by user and calculate progress
  const modulesByUser = new Map<string, UserModule[]>();
  (allModules || []).forEach(module => {
    const existing = modulesByUser.get(module.user_id) || [];
    existing.push(module as UserModule);
    modulesByUser.set(module.user_id, existing);
  });

  return members.map(member => {
    const userModules = modulesByUser.get(member.id) || [];
    const completedCount = userModules.filter(m => m.completed).length;
    const progress = totalModules ? Math.round((completedCount / totalModules) * 100) : 0;

    return {
      ...member,
      modules: userModules,
      progress,
    };
  });
}

/**
 * Get all profiles (for admin view)
 */
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching all profiles:', error.message);
    return [];
  }

  return data as Profile[];
}

/**
 * Get profiles by role
 */
export async function getProfilesByRole(role: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching profiles by role:', error.message);
    return [];
  }

  return data as Profile[];
}
