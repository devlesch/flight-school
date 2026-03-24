import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Profile } from '../../types/database';

const mockGetLeadershipByRegion = vi.fn();

vi.mock('../../services/teamService', () => ({
  getLeadershipByRegion: (...args: unknown[]) => mockGetLeadershipByRegion(...args),
}));

const { useLeadershipTeam } = await import('../../hooks/useLeadershipTeam');

const mockRD: Profile = {
  id: 'rd-1',
  email: 'rd@industriousoffice.com',
  name: 'Alex Director',
  role: 'Manager',
  avatar: null,
  title: 'Regional Director',
  region: 'North East',
  location: null,
  standardized_role: 'Regional Director',
  manager_id: null,
  department: 'Operations',
  start_date: null,
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockGM: Profile = {
  id: 'gm-1',
  email: 'gm@industriousoffice.com',
  name: 'Sam Manager',
  role: 'Manager',
  avatar: null,
  title: 'General Manager',
  region: 'North East',
  location: null,
  standardized_role: 'General Manager',
  manager_id: 'rd-1',
  department: 'Operations',
  start_date: null,
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('useLeadershipTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getLeadershipByRegion with provided region', async () => {
    mockGetLeadershipByRegion.mockResolvedValue([mockRD, mockGM]);

    const { result } = renderHook(() => useLeadershipTeam('North East'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetLeadershipByRegion).toHaveBeenCalledWith('North East');
  });

  it('returns leaders mapped with roleLabel from standardized_role', async () => {
    mockGetLeadershipByRegion.mockResolvedValue([mockRD, mockGM]);

    const { result } = renderHook(() => useLeadershipTeam('North East'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaders).toHaveLength(2);
    expect(result.current.leaders[0]).toEqual({
      profile: mockRD,
      roleLabel: 'Regional Director',
    });
    expect(result.current.leaders[1]).toEqual({
      profile: mockGM,
      roleLabel: 'General Manager',
    });
    expect(result.current.error).toBeNull();
  });

  it('returns empty leaders array when region is null', async () => {
    const { result } = renderHook(() => useLeadershipTeam(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetLeadershipByRegion).not.toHaveBeenCalled();
    expect(result.current.leaders).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns empty leaders array when region is undefined', async () => {
    const { result } = renderHook(() => useLeadershipTeam(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetLeadershipByRegion).not.toHaveBeenCalled();
    expect(result.current.leaders).toEqual([]);
  });

  it('returns empty leaders array when service returns empty', async () => {
    mockGetLeadershipByRegion.mockResolvedValue([]);

    const { result } = renderHook(() => useLeadershipTeam('Antarctica'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaders).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error state on service failure', async () => {
    mockGetLeadershipByRegion.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLeadershipTeam('North East'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaders).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });
});
