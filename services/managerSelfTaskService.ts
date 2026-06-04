import { supabase } from '../lib/supabase';
import { getTaskTemplates } from './managerTaskService';
import type { ManagerSelfTask, ManagerTaskTemplate } from '../types/database';

export interface SelfTaskWithTemplate extends ManagerSelfTask {
  template?: ManagerTaskTemplate;
}

export interface SelfTasksResult {
  tasks: SelfTaskWithTemplate[];
  /** True when the manager has no start_date — UI should suppress due/overdue chips. */
  anchorMissing: boolean;
}

/**
 * Fetch the manager's own start_date (anchor for due_date_offset). Null-safe.
 */
async function getManagerStartDate(managerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('start_date')
    .eq('id', managerId)
    .single();

  if (error) {
    console.error('Error fetching manager start_date:', error.message);
    return null;
  }
  return (data as { start_date: string | null } | null)?.start_date ?? null;
}

/**
 * Read the manager's self-tasks, joined to their (non-deleted) templates.
 * Rows whose template is missing or soft-deleted are dropped so the UI never
 * renders a blank card.
 */
export async function getSelfTasks(managerId: string): Promise<SelfTaskWithTemplate[]> {
  const { data: rows, error } = await supabase
    .from('manager_self_tasks')
    .select('*')
    .eq('manager_id', managerId);

  if (error) {
    console.error('Error fetching self tasks:', error.message);
    return [];
  }
  if (!rows || rows.length === 0) return [];

  const templates = await getTaskTemplates(); // non-deleted only
  const templateMap = new Map(templates.map(t => [t.id, t]));

  return (rows as ManagerSelfTask[])
    .filter(row => templateMap.has(row.template_id))
    .map(row => ({ ...row, template: templateMap.get(row.template_id) }));
}

/**
 * Idempotently reconcile a manager's self-tasks against the current template set:
 * insert a row for every non-deleted template the manager doesn't yet have, with
 * due_date = manager.start_date + template.due_date_offset. Self-heals when admins
 * add templates later. Steady state (nothing missing) does no write.
 */
export async function reconcileSelfTasks(managerId: string): Promise<SelfTasksResult> {
  const templates = await getTaskTemplates(); // non-deleted only
  if (templates.length === 0) {
    return { tasks: [], anchorMissing: false };
  }

  const { data: existing, error: existingError } = await supabase
    .from('manager_self_tasks')
    .select('template_id')
    .eq('manager_id', managerId);

  if (existingError) {
    console.error('Error reading existing self tasks:', existingError.message);
    return { tasks: await getSelfTasks(managerId), anchorMissing: false };
  }

  const haveTemplateIds = new Set(((existing ?? []) as { template_id: string }[]).map(r => r.template_id));
  const missing = templates.filter(t => !haveTemplateIds.has(t.id));

  const startDate = await getManagerStartDate(managerId);
  const anchor = startDate ?? new Date().toISOString().split('T')[0];

  if (missing.length > 0) {
    const rowsToInsert = missing.map(template => {
      const due = new Date(anchor);
      due.setDate(due.getDate() + template.due_date_offset);
      return {
        manager_id: managerId,
        template_id: template.id,
        completed: false,
        due_date: due.toISOString().split('T')[0],
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('manager_self_tasks')
      .upsert(rowsToInsert, { onConflict: 'manager_id,template_id', ignoreDuplicates: true });

    if (insertError) {
      console.error('Error reconciling self tasks:', insertError.message);
    }
  }

  return { tasks: await getSelfTasks(managerId), anchorMissing: startDate === null };
}

/**
 * Toggle completion on a self-task.
 */
export async function updateSelfTaskCompletion(
  taskId: string,
  completed: boolean
): Promise<ManagerSelfTask | null> {
  const updateData: Record<string, unknown> = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('manager_self_tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating self task:', error.message);
    return null;
  }
  return data as ManagerSelfTask;
}
