import { useState, useEffect, useCallback } from 'react';
import type { CohortWithLeaders } from '../types/database';
import { getCohortsWithLeaders } from '../services/cohortService';

export interface UseCohortsReturn {
  cohorts: CohortWithLeaders[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching cohorts with their training leaders
 */
export function useCohorts(): UseCohortsReturn {
  const [cohorts, setCohorts] = useState<CohortWithLeaders[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCohorts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCohortsWithLeaders();
      setCohorts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  return {
    cohorts,
    loading,
    error,
    refetch: fetchCohorts,
  };
}
