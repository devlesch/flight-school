import { supabase } from '../lib/supabase';
import type { TrainingModule, UserModule } from '../types/database';

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
 * Get all training module definitions
 */
export async function getModules(): Promise<TrainingModule[]> {
  const { data, error } = await supabase
    .from('training_modules')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching modules:', error.message);
    return [];
  }

  return data as TrainingModule[];
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
export async function getModulesWithProgress(userId: string): Promise<(TrainingModule & { progress?: UserModule })[]> {
  const [modules, userModules] = await Promise.all([
    getModules(),
    getUserModules(userId),
  ]);

  const progressMap = new Map(userModules.map(um => [um.module_id, um]));

  return modules.map(module => ({
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
    if (updates.completed) {
      updateData.completed_at = new Date().toISOString();
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
    if (updates.completed) {
      insertData.completed_at = new Date().toISOString();
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
 * Toggle module like status
 */
export async function toggleModuleLike(
  userId: string,
  moduleId: string,
  liked: boolean
): Promise<UserModule | null> {
  return updateModuleProgress(userId, moduleId, { liked });
}
