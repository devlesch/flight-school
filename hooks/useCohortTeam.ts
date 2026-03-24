import { useState, useEffect, useCallback } from 'react';
import type { ManagerCohortData } from '../services/cohortService';
import { getCohortMembersForManager } from '../services/cohortService';

export interface UseCohortTeamReturn {
  data: ManagerCohortData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching a manager's cohort team with enriched member data.
 * Resolves: manager → cohort_leaders → cohort → members by date range → progress
 */
export function useCohortTeam(managerId: string | undefined): UseCohortTeamReturn {
  const [data, setData] = useState<ManagerCohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!managerId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getCohortMembersForManager(managerId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cohort team');
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
