import { useState, useEffect } from 'react';
import type { Profile } from '../types/database';
import { useManager } from './useManager';
import { getProfileByName } from '../services/profileService';
import { SUPPORT_FALLBACK_NAME } from '../constants';

export type SupportContactSource = 'manager' | 'fallback' | 'none';

export interface UseSupportContactReturn {
  contact: Profile | null;
  source: SupportContactSource;
  loading: boolean;
  error: Error | null;
}

/**
 * Resolves the support contact for a signed-in user.
 *
 * Resolution order (strict):
 *  1. `profile.manager_id` → `getProfile(managerId)` via `useManager`. If that
 *     yields a profile, return `{ source: "manager" }`.
 *  2. Else (manager_id null/undefined or `getProfile` returned null), look up
 *     `getProfileByName(SUPPORT_FALLBACK_NAME)`. If that yields a profile,
 *     return `{ source: "fallback" }`.
 *  3. Else, return `{ source: "none", contact: null }`.
 *
 * Errors from either tier propagate into `error` with `source: "none"` and
 * `contact: null`. During fetches, `loading` is `true`.
 */
export function useSupportContact(
  profile: Profile | null | undefined
): UseSupportContactReturn {
  const managerId = profile?.manager_id ?? null;
  const { manager, loading: managerLoading, error: managerError } = useManager(managerId);

  const [fallbackContact, setFallbackContact] = useState<Profile | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState<boolean>(false);
  const [fallbackError, setFallbackError] = useState<Error | null>(null);
  const [fallbackAttempted, setFallbackAttempted] = useState<boolean>(false);

  // Chain the fallback lookup once `useManager` settles with `manager: null`
  // (and no manager-tier error). If `useManager` succeeded with a manager, the
  // fallback lookup is skipped entirely.
  useEffect(() => {
    let cancelled = false;

    // Wait for the manager tier to finish.
    if (managerLoading) {
      return () => {
        cancelled = true;
      };
    }

    // If the manager tier errored, do NOT attempt fallback — surface the error.
    if (managerError) {
      setFallbackContact(null);
      setFallbackLoading(false);
      setFallbackError(null);
      setFallbackAttempted(true);
      return () => {
        cancelled = true;
      };
    }

    // Manager hit: nothing to fall back to.
    if (manager) {
      setFallbackContact(null);
      setFallbackLoading(false);
      setFallbackError(null);
      setFallbackAttempted(true);
      return () => {
        cancelled = true;
      };
    }

    // Manager missing → fire fallback lookup.
    setFallbackLoading(true);
    setFallbackError(null);
    setFallbackAttempted(false);

    getProfileByName(SUPPORT_FALLBACK_NAME)
      .then((data) => {
        if (cancelled) return;
        setFallbackContact(data);
        setFallbackError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFallbackContact(null);
        setFallbackError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setFallbackLoading(false);
        setFallbackAttempted(true);
      });

    return () => {
      cancelled = true;
    };
  }, [managerLoading, managerError, manager]);

  // Compose the return value.
  if (managerLoading) {
    return { contact: null, source: 'none', loading: true, error: null };
  }

  if (managerError) {
    return { contact: null, source: 'none', loading: false, error: managerError };
  }

  if (manager) {
    return { contact: manager, source: 'manager', loading: false, error: null };
  }

  if (fallbackLoading || !fallbackAttempted) {
    return { contact: null, source: 'none', loading: true, error: null };
  }

  if (fallbackError) {
    return { contact: null, source: 'none', loading: false, error: fallbackError };
  }

  if (fallbackContact) {
    return { contact: fallbackContact, source: 'fallback', loading: false, error: null };
  }

  return { contact: null, source: 'none', loading: false, error: null };
}
