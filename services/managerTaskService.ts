import { supabase } from '../lib/supabase';
import type { ManagerTaskTemplate, UserManagerTask } from '../types/database';

export interface TaskWithTemplate extends UserManagerTask {
  template?: ManagerTaskTemplate;
}

/**
 * Get all manager task templates
 */
export async function getTaskTemplates(includeDeleted = false): Promise<ManagerTaskTemplate[]> {
  let query = supabase
    .from('manager_task_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching task templates:', error.message);
    return [];
  }

  return data as ManagerTaskTemplate[];
}

/**
 * Create a new manager task template
 */
export async function createTaskTemplate(data: {
  title: string;
  description?: string | null;
  due_date_offset: number;
  time_estimate?: string | null;
}): Promise<ManagerTaskTemplate | null> {
  // Auto-assign sort_order
  const templates = await getTaskTemplates(true);
  const maxSort = templates.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (supabase as any)
    .from('manager_task_templates')
    .insert({ ...data, sort_order: maxSort + 1 })
    .select()
    .single();

  if (error) {
    console.error('Error creating task template:', error.message);
    return null;
  }
  return created as ManagerTaskTemplate;
}

/**
 * Update a manager task template
 */
export async function updateTaskTemplate(
  id: string,
  data: { title?: string; description?: string | null; due_date_offset?: number; time_estimate?: string | null }
): Promise<ManagerTaskTemplate | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from('manager_task_templates')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating task template:', error.message);
    return null;
  }
  return updated as ManagerTaskTemplate;
}

/**
 * Soft delete a manager task template
 */
export async function deleteTaskTemplate(id: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('manager_task_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting task template:', error.message);
    return false;
  }
  return true;
}

/**
 * Restore a soft-deleted manager task template
 */
export async function restoreTaskTemplate(id: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('manager_task_templates')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    console.error('Error restoring task template:', error.message);
    return false;
  }
  return true;
}

/**
 * Get manager tasks for a specific new hire
 */
export async function getUserTasks(
  managerId: string,
  newHireId: string
): Promise<TaskWithTemplate[]> {
  // Get user tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('user_manager_tasks')
    .select('*')
    .eq('manager_id', managerId)
    .eq('new_hire_id', newHireId);

  if (tasksError) {
    console.error('Error fetching user tasks:', tasksError.message);
    return [];
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Cast tasks to proper type
  const typedTasks = tasks as UserManagerTask[];

  // Get templates for these tasks
  const templateIds = typedTasks.map(t => t.template_id);
  const { data: templates, error: templatesError } = await supabase
    .from('manager_task_templates')
    .select('*')
    .in('id', templateIds);

  if (templatesError) {
    console.error('Error fetching templates:', templatesError.message);
    return typedTasks as TaskWithTemplate[];
  }

  // Join tasks with templates
  const templateMap = new Map((templates || []).map(t => [t.id, t as ManagerTaskTemplate]));

  return typedTasks.map(task => ({
    ...task,
    template: templateMap.get(task.template_id),
  }));
}

/**
 * Initialize tasks for a new hire based on templates
 */
export async function initializeTasksForNewHire(
  managerId: string,
  newHireId: string,
  startDate: string
): Promise<TaskWithTemplate[]> {
  // Get all templates
  const templates = await getTaskTemplates();

  if (templates.length === 0) {
    return [];
  }

  // Calculate due dates based on start date and offsets
  const start = new Date(startDate);
  const tasksToInsert = templates.map(template => {
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + template.due_date_offset);

    return {
      manager_id: managerId,
      new_hire_id: newHireId,
      template_id: template.id,
      due_date: dueDate.toISOString().split('T')[0],
      completed: false,
    };
  });

  // Insert all tasks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('user_manager_tasks')
    .insert(tasksToInsert)
    .select();

  if (error) {
    console.error('Error initializing tasks:', error.message);
    return [];
  }

  // Return with templates attached
  const templateMap = new Map(templates.map(t => [t.id, t]));
  return (data as UserManagerTask[]).map(task => ({
    ...task,
    template: templateMap.get(task.template_id),
  }));
}

/**
 * Update task completion status
 */
export async function updateTaskCompletion(
  taskId: string,
  completed: boolean
): Promise<UserManagerTask | null> {
  const updateData: Record<string, unknown> = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('user_manager_tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error.message);
    return null;
  }

  return data as UserManagerTask;
}

/**
 * Get all tasks for a manager (across all new hires)
 */
export async function getAllManagerTasks(managerId: string): Promise<TaskWithTemplate[]> {
  const { data: tasks, error: tasksError } = await supabase
    .from('user_manager_tasks')
    .select('*')
    .eq('manager_id', managerId);

  if (tasksError) {
    console.error('Error fetching manager tasks:', tasksError.message);
    return [];
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Get all templates
  const templates = await getTaskTemplates();
  const templateMap = new Map(templates.map(t => [t.id, t]));

  return (tasks as UserManagerTask[]).map(task => ({
    ...task,
    template: templateMap.get(task.template_id),
  }));
}
