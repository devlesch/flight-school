import { useState, useEffect, useCallback } from 'react';
import type { Profile } from '../types/database';
import { getReportingChain } from '../services/teamService';

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
 * Hook for fetching a user's leadership — their reporting chain
 * (direct manager up to the top), ordered closest-first.
 */
export function useLeadershipTeam(userId: string | null | undefined): UseLeadershipTeamReturn {
  const [leaders, setLeaders] = useState<LeaderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaders = useCallback(async () => {
    if (!userId) {
      setLeaders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profiles = await getReportingChain(userId);
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
  }, [userId]);

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
