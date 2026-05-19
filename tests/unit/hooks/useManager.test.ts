import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Profile } from '../../../types/database';

const mockGetProfile = vi.fn();

vi.mock('../../../services/profileService', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

const { useManager } = await import('../../../hooks/useManager');

const mockManager: Profile = {
  id: 'mgr-1',
  email: 'manager@industriousoffice.com',
  name: 'Jane Manager',
  role: 'Manager',
  avatar: 'https://example.com/avatar.jpg',
  title: 'Area Manager',
  region: 'East',
  location: null,
  standardized_role: 'Area Manager',
  manager_id: null,
  department: 'Operations',
  start_date: null,
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('useManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null short-circuit', () => {
    it('returns { manager: null, loading: false, error: null } when managerId is null', async () => {
      const { result } = renderHook(() => useManager(null));

      // Synchronously short-circuited — no waitFor needed.
      expect(result.current.manager).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('returns { manager: null, loading: false, error: null } when managerId is undefined', async () => {
      const { result } = renderHook(() => useManager(undefined));

      expect(result.current.manager).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockGetProfile).not.toHaveBeenCalled();
    });
  });

  describe('loading → resolved transition', () => {
    it('starts in loading state then resolves to the manager Profile', async () => {
      let resolveFn: (value: Profile | null) => void = () => {};
      const pending = new Promise<Profile | null>((resolve) => {
        resolveFn = resolve;
      });
      mockGetProfile.mockReturnValue(pending);

      const { result } = renderHook(() => useManager('mgr-1'));

      // Initial render: loading is true, no manager yet, no error.
      expect(result.current.loading).toBe(true);
      expect(result.current.manager).toBeNull();
      expect(result.current.error).toBeNull();

      // Resolve the pending getProfile call.
      resolveFn(mockManager);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetProfile).toHaveBeenCalledWith('mgr-1');
      expect(result.current.manager).toEqual(mockManager);
      expect(result.current.error).toBeNull();
    });
  });

  describe('getProfile rejection', () => {
    it('surfaces a getProfile rejection into error and leaves manager null', async () => {
      const boom = new Error('supabase down');
      mockGetProfile.mockRejectedValue(boom);

      const { result } = renderHook(() => useManager('mgr-1'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetProfile).toHaveBeenCalledWith('mgr-1');
      expect(result.current.manager).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('supabase down');
    });
  });
});
