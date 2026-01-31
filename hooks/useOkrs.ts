import { useState, useEffect, useCallback } from 'react';
import type { OkrWithKeyResults } from '../services/okrService';
import { getUserOkrs, getOkrs } from '../services/okrService';

export interface UseOkrsReturn {
  okrs: OkrWithKeyResults[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching user's assigned OKRs
 */
export function useOkrs(userId: string | undefined): UseOkrsReturn {
  const [okrs, setOkrs] = useState<OkrWithKeyResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOkrs = useCallback(async () => {
    if (!userId) {
      setOkrs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getUserOkrs(userId);
      setOkrs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OKRs');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOkrs();
  }, [fetchOkrs]);

  return {
    okrs,
    loading,
    error,
    refetch: fetchOkrs,
  };
}

/**
 * Hook for fetching all OKRs (admin view)
 */
export function useAllOkrs(): UseOkrsReturn {
  const [okrs, setOkrs] = useState<OkrWithKeyResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOkrs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getOkrs();
      setOkrs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OKRs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOkrs();
  }, [fetchOkrs]);

  return {
    okrs,
    loading,
    error,
    refetch: fetchOkrs,
  };
}
