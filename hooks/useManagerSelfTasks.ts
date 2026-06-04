import { useState, useEffect, useCallback } from 'react';
import type { SelfTaskWithTemplate } from '../services/managerSelfTaskService';
import {
  reconcileSelfTasks,
  updateSelfTaskCompletion,
} from '../services/managerSelfTaskService';

export interface UseManagerSelfTasksReturn {
  tasks: SelfTaskWithTemplate[];
  anchorMissing: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleComplete: (taskId: string, completed: boolean) => Promise<void>;
}

/**
 * Hook for a manager's personal onboarding checklist ("My Manager Path").
 * Reconciles against the current template set on mount, then exposes optimistic
 * toggle for completion.
 */
export function useManagerSelfTasks(managerId: string | undefined): UseManagerSelfTasksReturn {
  const [tasks, setTasks] = useState<SelfTaskWithTemplate[]>([]);
  const [anchorMissing, setAnchorMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!managerId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { tasks: data, anchorMissing: missing } = await reconcileSelfTasks(managerId);
      setTasks(data);
      setAnchorMissing(missing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    const result = await updateSelfTaskCompletion(taskId, completed);
    if (result) {
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, completed: result.completed, completed_at: result.completed_at }
            : t
        )
      );
    }
  };

  return {
    tasks,
    anchorMissing,
    loading,
    error,
    refetch: fetchTasks,
    toggleComplete: handleToggleComplete,
  };
}
