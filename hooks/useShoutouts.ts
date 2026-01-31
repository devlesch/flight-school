import { useState, useEffect, useCallback } from 'react';
import type { ShoutoutWithSender } from '../services/shoutoutService';
import { getShoutoutsForUser, createShoutout } from '../services/shoutoutService';

export interface UseShoutoutsReturn {
  shoutouts: ShoutoutWithSender[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sendShoutout: (toUserId: string, message: string) => Promise<boolean>;
}

/**
 * Hook for managing shoutouts received by a user
 */
export function useShoutouts(userId: string | undefined): UseShoutoutsReturn {
  const [shoutouts, setShoutouts] = useState<ShoutoutWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShoutouts = useCallback(async () => {
    if (!userId) {
      setShoutouts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getShoutoutsForUser(userId);
      setShoutouts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shoutouts');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchShoutouts();
  }, [fetchShoutouts]);

  const handleSendShoutout = async (toUserId: string, message: string): Promise<boolean> => {
    if (!userId) return false;

    const result = await createShoutout(userId, toUserId, message);
    return result !== null;
  };

  return {
    shoutouts,
    loading,
    error,
    refetch: fetchShoutouts,
    sendShoutout: handleSendShoutout,
  };
}
