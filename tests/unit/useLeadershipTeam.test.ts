import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Profile } from '../../types/database';

const mockGetReportingChain = vi.fn();

vi.mock('../../services/teamService', () => ({
  getReportingChain: (...args: unknown[]) => mockGetReportingChain(...args),
}));

const { useLeadershipTeam } = await import('../../hooks/useLeadershipTeam');

// Reporting chain, closest-first: direct manager (GM) then their manager (RD).
const mockGM: Profile = {
  id: 'gm-1',
  email: 'gm@industriousoffice.com',
  name: 'Sam Manager',
  role: 'Manager',
  avatar: null,
  title: 'General Manager',
  region: 'East',
  location: null,
  standardized_role: 'GM',
  manager_id: 'rd-1',
  department: 'Operations',
  start_date: null,
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockRD: Profile = {
  id: 'rd-1',
  email: 'rd@industriousoffice.com',
  name: 'Alex Director',
  role: 'Manager',
  avatar: null,
  title: 'Regional Director',
  region: 'East',
  location: null,
  standardized_role: 'RD',
  manager_id: null,
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

  it('calls getReportingChain with the provided user id', async () => {
    mockGetReportingChain.mockResolvedValue([mockGM, mockRD]);

    const { result } = renderHook(() => useLeadershipTeam('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetReportingChain).toHaveBeenCalledWith('user-1');
  });

  it('returns the reporting chain mapped with roleLabel from standardized_role', async () => {
    mockGetReportingChain.mockResolvedValue([mockGM, mockRD]);

    const { result } = renderHook(() => useLeadershipTeam('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaders).toHaveLength(2);
    expect(result.current.leaders[0]).toEqual({ profile: mockGM, roleLabel: 'GM' });
    expect(result.current.leaders[1]).toEqual({ profile: mockRD, roleLabel: 'RD' });
    expect(result.current.error).toBeNull();
  });

  it('returns empty leaders array when userId is null', async () => {
    const { result } = renderHook(() => useLeadershipTeam(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetReportingChain).not.toHaveBeenCalled();
    expect(result.current.leaders).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns empty leaders array when userId is undefined', async () => {
    const { result } = renderHook(() => useLeadershipTeam(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetReportingChain).not.toHaveBeenCalled();
    expect(result.current.leaders).toEqual([]);
  });

  it('returns empty leaders array when the chain is empty (top of the org)', async () => {
    mockGetReportingChain.mockResolvedValue([]);

    const { result } = renderHook(() => useLeadershipTeam('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaders).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error state on service failure', async () => {
    mockGetReportingChain.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLeadershipTeam('user-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaders).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });
});
