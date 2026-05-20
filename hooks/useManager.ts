import { useState, useEffect } from 'react';
import type { Profile } from '../types/database';
import { getProfile } from '../services/profileService';

export interface UseManagerReturn {
  manager: Profile | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching a user's direct manager profile by `manager_id`.
 *
 * Resolution rules:
 *  - `managerId` null/undefined → short-circuit with `{ manager: null, loading: false, error: null }`.
 *    No Supabase call is made.
 *  - Otherwise, calls `services/profileService.ts:getProfile(managerId)` (real Supabase read)
 *    and exposes loading/error state.
 *  - If `getProfile` rejects (mocked or otherwise throws), the rejection is surfaced into
 *    `error` and `manager` stays `null`.
 *
 * Note: `getProfile` currently swallows Supabase errors and returns `null` (logs them).
 * That means in production a "not found" path yields `manager: null, error: null`.
 * Callers wanting to distinguish "missing" vs "errored" should compare both fields.
 */
export function useManager(
  managerId: string | null | undefined
): UseManagerReturn {
  const [manager, setManager] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!managerId);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!managerId) {
      // Short-circuit: no Supabase call.
      setManager(null);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    getProfile(managerId)
      .then((data) => {
        if (cancelled) return;
        setManager(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setManager(null);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [managerId]);

  return { manager, loading, error };
}
