import { useState, useEffect, useRef } from 'react';
import { parseLessonlyId, getLessonlyStatuses, LessonlyStatus } from '../services/lessonlyService';

export interface LessonlyModuleStatus {
  status: 'Completed' | 'Incomplete' | 'not_found' | 'loading' | 'error';
  completedAt: string | null;
}

interface LessonlyModule {
  id: string;
  type: string;
  link?: string;
}

/**
 * Hook to fetch Lessonly completion statuses for LESSONLY-type modules.
 * Caches results per email to avoid redundant API calls on tab switches.
 */
export function useLessonlyStatus(
  email: string | null,
  modules: LessonlyModule[]
): { statuses: Record<string, LessonlyModuleStatus>; loading: boolean; error: string | null } {
  const [statuses, setStatuses] = useState<Record<string, LessonlyModuleStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, Record<string, LessonlyModuleStatus>>>({});

  useEffect(() => {
    if (!email) return;

    // Filter to LESSONLY modules with parseable lesson IDs
    const lessonlyModules = modules.filter(m => m.type === 'LESSONLY' && m.link);
    if (lessonlyModules.length === 0) return;

    // Check cache
    const cacheKey = email.toLowerCase();
    if (cacheRef.current[cacheKey]) {
      setStatuses(cacheRef.current[cacheKey]);
      return;
    }

    // Build module ID → lesson ID mapping
    const moduleToLessonId = new Map<string, number>();
    const lessonIds: number[] = [];

    for (const mod of lessonlyModules) {
      const lessonId = parseLessonlyId(mod.link!);
      if (lessonId) {
        moduleToLessonId.set(mod.id, lessonId);
        lessonIds.push(lessonId);
      }
    }

    if (lessonIds.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getLessonlyStatuses(email, lessonIds).then(response => {
      if (cancelled) return;

      if (!response.success) {
        setError(response.error || 'Failed to fetch Lessonly statuses');
        setLoading(false);
        return;
      }

      // Map lesson statuses back to module IDs
      const result: Record<string, LessonlyModuleStatus> = {};
      for (const [moduleId, lessonId] of moduleToLessonId) {
        const lessonStatus = response.statuses[lessonId];
        if (lessonStatus) {
          result[moduleId] = {
            status: lessonStatus.status as LessonlyModuleStatus['status'],
            completedAt: lessonStatus.completed_at,
          };
        } else {
          result[moduleId] = { status: 'not_found', completedAt: null };
        }
      }

      // Cache and set
      cacheRef.current[cacheKey] = result;
      setStatuses(result);
      setLoading(false);
    }).catch(err => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [email, modules]);

  return { statuses, loading, error };
}
