import { useState, useEffect, useCallback } from 'react';
import { useAllUsers } from './useTeam';
import { getUserModulesBatch, getModules } from '../services/moduleService';
import { mapToNewHireProfiles, computeAdminStats } from '../services/adminStatsMapper';
import type { NewHireProfile } from '../types';

export interface AdminStats {
  activeCount: number;
  avgProgress: number;
  atRiskCount: number;
}

export interface UseAdminDashboardReturn {
  students: NewHireProfile[];
  stats: AdminStats;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Facade hook for the Admin Dashboard. Composes useAllUsers() with
 * batch module progress to produce mapped NewHireProfile[] and
 * pre-computed KPI stats.
 */
export function useAdminDashboard(): UseAdminDashboardReturn {
  const { users, loading: usersLoading, error: usersError, refetch } = useAllUsers();

  const [students, setStudents] = useState<NewHireProfile[]>([]);
  const [stats, setStats] = useState<AdminStats>({ activeCount: 0, avgProgress: 0, atRiskCount: 0 });
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const enrichUsers = useCallback(async () => {
    if (usersLoading || users.length === 0) {
      setStudents([]);
      setStats({ activeCount: 0, avgProgress: 0, atRiskCount: 0 });
      return;
    }

    setEnrichLoading(true);
    setEnrichError(null);

    try {
      const userIds = users.map(u => u.id);
      const [userModules, dbModules] = await Promise.all([
        getUserModulesBatch(userIds),
        getModules(),
      ]);

      const mapped = mapToNewHireProfiles(users, userModules, dbModules);
      const computedStats = computeAdminStats(mapped);

      setStudents(mapped);
      setStats(computedStats);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : 'Failed to load module data');
    } finally {
      setEnrichLoading(false);
    }
  }, [users, usersLoading]);

  useEffect(() => {
    enrichUsers();
  }, [enrichUsers]);

  return {
    students,
    stats,
    loading: usersLoading || enrichLoading,
    error: usersError || enrichError,
    refetch,
  };
}
