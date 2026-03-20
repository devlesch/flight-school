import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  signInWithGoogle,
  signOut,
  getSession,
  onAuthStateChange,
} from '../services/authService';
import { supabase } from '../lib/supabase';
import { updateProfile } from '../services/profileService';

export interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Hook for managing authentication state
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    getSession().then((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Record login events
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          supabase.from('session_logs').insert({ user_id: session.user.id }).then();

          // Sync Google avatar to profile on every login
          const avatarUrl = session.user.user_metadata?.avatar_url;
          if (avatarUrl) {
            updateProfile(session.user.id, { avatar: avatarUrl } as any);
          }
        }
      }
    );

    return () => {
      unsubscribe();
      authSub.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setLoading(true);
    try {
      await signOut();
      setUser(null);
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    session,
    loading,
    error,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };
}
