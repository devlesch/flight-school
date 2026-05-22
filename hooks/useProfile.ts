import { useState, useEffect } from 'react';
import type { Profile } from '../types/database';
import { getCurrentProfile } from '../services/profileService';
import { supabase } from '../lib/supabase';

// The derived role returned by the `get_my_role()` RPC (migration 023).
// 'NewHire' (no space) is the SQL spelling — App.tsx maps it to UserRole.
export type DerivedRole = 'Admin' | 'Manager' | 'NewHire';

export interface UseProfileReturn {
  profile: Profile | null;
  derivedRole: DerivedRole | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing the current user's profile
 */
export function useProfile(userId: string | undefined): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [derivedRole, setDerivedRole] = useState<DerivedRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!userId) {
      setProfile(null);
      setDerivedRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getCurrentProfile();
      setProfile(data);

      // Resolve the derived role from the single source of truth
      // (is_admin / is_manager / is_manager_override) via the get_my_role() RPC.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: roleData, error: roleError } = await (supabase as any).rpc('get_my_role');
      if (roleError) {
        console.error('Error fetching derived role:', roleError.message);
        setDerivedRole(null);
      } else {
        setDerivedRole((roleData as DerivedRole) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  return {
    profile,
    derivedRole,
    loading,
    error,
    refetch: fetchProfile,
  };
}
