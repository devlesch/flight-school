import { useState, useEffect, useCallback } from 'react';
import type { Profile } from '../types/database';
import { getLeadershipByRegion } from '../services/teamService';

export interface LeaderProfile {
  profile: Profile;
  roleLabel: string;
}

export interface UseLeadershipTeamReturn {
  leaders: LeaderProfile[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching leadership team profiles by region
 */
export function useLeadershipTeam(region: string | null | undefined): UseLeadershipTeamReturn {
  const [leaders, setLeaders] = useState<LeaderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaders = useCallback(async () => {
    if (!region) {
      setLeaders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profiles = await getLeadershipByRegion(region);
      setLeaders(
        profiles.map(p => ({
          profile: p,
          roleLabel: p.standardized_role || 'Unknown',
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leadership team');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchLeaders();
  }, [fetchLeaders]);

  return {
    leaders,
    loading,
    error,
    refetch: fetchLeaders,
  };
}
