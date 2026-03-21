import { useState, useEffect, useCallback } from 'react';
import type { TrainingModule, UserModule } from '../types/database';
import {
  getModulesWithProgress,
  markModuleComplete,
  markModuleIncomplete,
  toggleModuleLike,
  updateModuleProgress,
} from '../services/moduleService';

export interface ModuleWithProgress extends TrainingModule {
  progress?: UserModule;
}

export interface UseModulesReturn {
  modules: ModuleWithProgress[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markComplete: (moduleId: string, score?: number) => Promise<void>;
  markIncomplete: (moduleId: string) => Promise<void>;
  toggleLike: (moduleId: string, liked: boolean) => Promise<void>;
  updateProgress: (moduleId: string, updates: Partial<UserModule>) => Promise<void>;
}

/**
 * Hook for managing training modules with user progress
 */
export function useModules(userId: string | undefined): UseModulesReturn {
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    if (!userId) {
      setModules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getModulesWithProgress(userId);
      setModules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleMarkComplete = async (moduleId: string, score?: number) => {
    if (!userId) return;

    const result = await markModuleComplete(userId, moduleId, score);
    if (result) {
      // Update local state
      setModules(prev =>
        prev.map(m =>
          m.id === moduleId ? { ...m, progress: result } : m
        )
      );
    }
  };

  const handleMarkIncomplete = async (moduleId: string) => {
    if (!userId) return;

    const result = await markModuleIncomplete(userId, moduleId);
    if (result) {
      setModules(prev =>
        prev.map(m =>
          m.id === moduleId ? { ...m, progress: result } : m
        )
      );
    }
  };

  const handleToggleLike = async (moduleId: string, liked: boolean) => {
    if (!userId) return;

    const result = await toggleModuleLike(userId, moduleId, liked);
    if (result) {
      setModules(prev =>
        prev.map(m =>
          m.id === moduleId ? { ...m, progress: result } : m
        )
      );
    }
  };

  const handleUpdateProgress = async (moduleId: string, updates: Partial<UserModule>) => {
    if (!userId) return;

    const result = await updateModuleProgress(userId, moduleId, updates);
    if (result) {
      setModules(prev =>
        prev.map(m =>
          m.id === moduleId ? { ...m, progress: result } : m
        )
      );
    }
  };

  return {
    modules,
    loading,
    error,
    refetch: fetchModules,
    markComplete: handleMarkComplete,
    markIncomplete: handleMarkIncomplete,
    toggleLike: handleToggleLike,
    updateProgress: handleUpdateProgress,
  };
}
