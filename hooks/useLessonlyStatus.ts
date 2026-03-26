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
  const fetchedRef = useRef<string | null>(null);

  // Stabilize: only re-fetch when email actually changes
  const emailKey = email?.toLowerCase() || null;

  useEffect(() => {
    if (!emailKey) return;

    // Already fetched for this email
    if (fetchedRef.current === emailKey) return;

    // Check cache
    if (cacheRef.current[emailKey]) {
      setStatuses(cacheRef.current[emailKey]);
      return;
    }

    // Filter to LESSONLY modules with parseable lesson IDs
    const lessonlyModules = modules.filter(m => m.type === 'LESSONLY' && m.link);
    if (lessonlyModules.length === 0) return;

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

    // Mark as fetching to prevent duplicate calls
    fetchedRef.current = emailKey;
    setLoading(true);
    setError(null);

    getLessonlyStatuses(emailKey, lessonIds).then(response => {
      if (!response.success) {
        setError(response.error || 'Failed to fetch Lessonly statuses');
        setLoading(false);
        fetchedRef.current = null; // Allow retry
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
      cacheRef.current[emailKey] = result;
      setStatuses(result);
      setLoading(false);
    }).catch(err => {
      console.error('Lessonly fetch error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
      fetchedRef.current = null; // Allow retry
    });
  }, [emailKey, modules]);

  // Reset when email changes (different user card)
  useEffect(() => {
    if (!emailKey) {
      fetchedRef.current = null;
      setStatuses({});
      setLoading(false);
      setError(null);
    }
  }, [emailKey]);

  return { statuses, loading, error };
}
