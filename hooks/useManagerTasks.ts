import { useState, useEffect, useCallback } from 'react';
import type { TaskWithTemplate } from '../services/managerTaskService';
import {
  getUserTasks,
  getAllManagerTasks,
  updateTaskCompletion,
  initializeTasksForNewHire,
} from '../services/managerTaskService';

export interface UseManagerTasksReturn {
  tasks: TaskWithTemplate[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleComplete: (taskId: string, completed: boolean) => Promise<void>;
  initializeTasks: (newHireId: string, startDate: string) => Promise<void>;
}

/**
 * Hook for managing tasks for a specific new hire
 */
export function useManagerTasks(
  managerId: string | undefined,
  newHireId?: string
): UseManagerTasksReturn {
  const [tasks, setTasks] = useState<TaskWithTemplate[]>([]);
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
      const data = newHireId
        ? await getUserTasks(managerId, newHireId)
        : await getAllManagerTasks(managerId);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [managerId, newHireId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    const result = await updateTaskCompletion(taskId, completed);
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

  const handleInitializeTasks = async (newHireId: string, startDate: string) => {
    if (!managerId) return;

    setLoading(true);
    try {
      const newTasks = await initializeTasksForNewHire(managerId, newHireId, startDate);
      setTasks(prev => [...prev, ...newTasks]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize tasks');
    } finally {
      setLoading(false);
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
    toggleComplete: handleToggleComplete,
    initializeTasks: handleInitializeTasks,
  };
}
