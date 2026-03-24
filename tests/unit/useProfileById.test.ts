import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Profile } from '../../types/database';

const mockGetProfile = vi.fn();

vi.mock('../../services/profileService', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

const { useProfileById } = await import('../../hooks/useProfileById');

const mockManager: Profile = {
  id: 'mgr-1',
  email: 'manager@industriousoffice.com',
  name: 'Jane Manager',
  role: 'Manager',
  avatar: 'https://example.com/avatar.jpg',
  title: 'Area Manager',
  region: 'North East',
  location: null,
  standardized_role: 'Area Manager',
  manager_id: null,
  department: 'Operations',
  start_date: null,
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('useProfileById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches profile by ID', async () => {
    mockGetProfile.mockResolvedValue(mockManager);

    const { result } = renderHook(() => useProfileById('mgr-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfile).toHaveBeenCalledWith('mgr-1');
    expect(result.current.profile).toEqual(mockManager);
    expect(result.current.error).toBeNull();
  });

  it('returns null profile when userId is null', async () => {
    const { result } = renderHook(() => useProfileById(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it('returns null profile when userId is undefined', async () => {
    const { result } = renderHook(() => useProfileById(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it('sets error state on service failure', async () => {
    mockGetProfile.mockRejectedValue(new Error('Profile not found'));

    const { result } = renderHook(() => useProfileById('bad-id'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBe('Profile not found');
  });
});
