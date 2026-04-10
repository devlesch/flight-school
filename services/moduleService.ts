import { supabase } from '../lib/supabase';
import type { TrainingModule, UserModule } from '../types/database';
import type { ModuleComment } from '../types';

/**
 * Create a new training module definition
 */
export async function createModule(data: TrainingModule['Insert']): Promise<TrainingModule | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (supabase as any)
    .from('training_modules')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('Error creating module:', error.message);
    return null;
  }

  return created as TrainingModule;
}

/**
 * Update an existing training module definition
 */
export async function updateModule(
  id: string,
  data: TrainingModule['Update']
): Promise<TrainingModule | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from('training_modules')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating module:', error.message);
    return null;
  }

  return updated as TrainingModule;
}

/**
 * Get all training module definitions
 */
export async function getModules(includeDeleted = false): Promise<TrainingModule[]> {
  let query = supabase
    .from('training_modules')
    .select('*')
    .order('sort_order', { ascending: true });

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching modules:', error.message);
    return [];
  }

  return data as TrainingModule[];
}

/**
 * Soft delete a training module (sets deleted_at)
 */
export async function deleteModule(id: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('training_modules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting module:', error.message);
    return false;
  }
  return true;
}

/**
 * Restore a soft-deleted training module
 */
export async function restoreModule(id: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('training_modules')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    console.error('Error restoring module:', error.message);
    return false;
  }
  return true;
}

/**
 * Get user_modules rows for multiple users in a single query
 */
export async function getUserModulesBatch(userIds: string[]): Promise<UserModule[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('user_modules')
    .select('*')
    .in('user_id', userIds);

  if (error) {
    console.error('Error fetching batch user modules:', error.message);
    return [];
  }
  return data as UserModule[];
}

/**
 * Get user's progress on all modules
 */
export async function getUserModules(userId: string): Promise<UserModule[]> {
  const { data, error } = await supabase
    .from('user_modules')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user modules:', error.message);
    return [];
  }

  return data as UserModule[];
}

/**
 * Get modules with user progress combined
 */
export async function getModulesWithProgress(userId: string, audienceFilter?: 'cohort' | 'direct' | 'both' | null): Promise<(TrainingModule & { progress?: UserModule })[]> {
  const [modules, userModules] = await Promise.all([
    getModules(),
    getUserModules(userId),
  ]);

  const progressMap = new Map(userModules.map(um => [um.module_id, um]));

  // Filter by audience if specified
  const filtered = audienceFilter && audienceFilter !== 'both'
    ? modules.filter(m => {
        const audience = (m as any).audience as string | null;
        if (!audience) return true; // null = all students
        return audience === audienceFilter;
      })
    : modules;

  return filtered.map(module => ({
    ...module,
    progress: progressMap.get(module.id),
  }));
}

/**
 * Update or create user module progress
 */
export async function updateModuleProgress(
  userId: string,
  moduleId: string,
  updates: {
    completed?: boolean;
    score?: number;
    liked?: boolean;
    due_date?: string;
  }
): Promise<UserModule | null> {
  // Check if record exists
  const { data: existing } = await supabase
    .from('user_modules')
    .select('id')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .single();

  const existingRecord = existing as { id: string } | null;

  if (existingRecord) {
    // Update existing record
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.completed === true) {
      updateData.completed_at = new Date().toISOString();
    } else if (updates.completed === false) {
      updateData.completed_at = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_modules')
      .update(updateData)
      .eq('id', existingRecord.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating module progress:', error.message);
      return null;
    }

    return data as UserModule;
  } else {
    // Insert new record
    const insertData: Record<string, unknown> = {
      user_id: userId,
      module_id: moduleId,
      ...updates,
    };
    if (updates.completed === true) {
      insertData.completed_at = new Date().toISOString();
    } else if (updates.completed === false) {
      insertData.completed_at = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_modules')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating module progress:', error.message);
      return null;
    }

    return data as UserModule;
  }
}

/**
 * Mark a module as complete
 */
export async function markModuleComplete(
  userId: string,
  moduleId: string,
  score?: number
): Promise<UserModule | null> {
  return updateModuleProgress(userId, moduleId, {
    completed: true,
    score,
  });
}

/**
 * Mark a module as incomplete
 */
export async function markModuleIncomplete(
  userId: string,
  moduleId: string
): Promise<UserModule | null> {
  return updateModuleProgress(userId, moduleId, { completed: false });
}

/**
 * Toggle module like status
 */
export async function toggleModuleLike(
  userId: string,
  moduleId: string,
  liked: boolean
): Promise<UserModule | null> {
  return updateModuleProgress(userId, moduleId, { liked });
}

/**
 * Get all comments grouped by module ID
 */
export async function getAllModuleComments(): Promise<Record<string, ModuleComment[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('module_comments')
    .select('*, profiles(name)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching all comments:', error.message);
    return {};
  }

  const grouped: Record<string, ModuleComment[]> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data || []) as any[]) {
    const moduleId = row.module_id;
    if (!grouped[moduleId]) grouped[moduleId] = [];
    grouped[moduleId].push({
      id: row.id,
      author: row.profiles?.name || 'Unknown',
      text: row.text,
      date: row.created_at,
    });
  }
  return grouped;
}

/**
 * Get comments for a module
 */
export async function getModuleComments(moduleId: string): Promise<ModuleComment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('module_comments')
    .select('*, profiles(name)')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    id: row.id,
    author: row.profiles?.name || 'Unknown',
    text: row.text,
    date: row.created_at,
  }));
}

/**
 * Add a comment to a module
 */
export async function addModuleComment(moduleId: string, userId: string, text: string): Promise<ModuleComment | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('module_comments')
    .insert({ module_id: moduleId, user_id: userId, text })
    .select('*, profiles(name)')
    .single();

  if (error) {
    console.error('Error adding comment:', error.message);
    return null;
  }

  return {
    id: data.id,
    author: data.profiles?.name || 'Unknown',
    text: data.text,
    date: data.created_at,
  };
}
