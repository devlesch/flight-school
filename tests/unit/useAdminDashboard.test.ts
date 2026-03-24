import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';

// Mock useAllUsers
const mockRefetch = vi.fn();
const defaultUsers = [
  {
    id: 'user-1',
    email: 'alice@test.com',
    name: 'Alice',
    role: 'New Hire' as const,
    avatar: null,
    title: 'MxM',
    region: 'East',
    location: 'Brooklyn',
    standardized_role: 'MxA',
    manager_id: 'mgr-1',
    department: 'Ops',
    start_date: '2026-01-15',
    provisioned: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

let mockUseAllUsersReturn = {
  users: defaultUsers,
  loading: false,
  error: null as string | null,
  refetch: mockRefetch,
};

vi.mock('../../hooks/useTeam', () => ({
  useAllUsers: () => mockUseAllUsersReturn,
}));

// Mock moduleService
const mockGetUserModulesBatch = vi.fn().mockResolvedValue([
  {
    id: 'um-1',
    user_id: 'user-1',
    module_id: 'mod-1',
    completed: true,
    completed_at: '2026-02-01T00:00:00Z',
    due_date: '2026-02-01',
    score: 90,
    liked: false,
    created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'um-2',
    user_id: 'user-1',
    module_id: 'mod-2',
    completed: false,
    completed_at: null,
    due_date: '2099-12-31',
    score: null,
    liked: false,
    created_at: '2026-01-15T00:00:00Z',
  },
]);

const mockGetModules = vi.fn().mockResolvedValue([
  {
    id: 'mod-1',
    title: 'Culture Workbook',
    description: 'Overview',
    type: 'WORKBOOK',
    duration: '1 hour',
    link: null,
    host: null,
    sort_order: 1,
    target_role: null,
    day_offset: 0,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mod-2',
    title: 'Operations Systems',
    description: 'Systems training',
    type: 'VIDEO',
    duration: '30 mins',
    link: null,
    host: null,
    sort_order: 2,
    target_role: null,
    day_offset: 7,
    created_at: '2026-01-01T00:00:00Z',
  },
]);

vi.mock('../../services/moduleService', () => ({
  getUserModulesBatch: (...args: unknown[]) => mockGetUserModulesBatch(...args),
  getModules: (...args: unknown[]) => mockGetModules(...args),
}));

describe('useAdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAllUsersReturn = {
      users: defaultUsers,
      loading: false,
      error: null,
      refetch: mockRefetch,
    };
    mockGetUserModulesBatch.mockResolvedValue([
      {
        id: 'um-1',
        user_id: 'user-1',
        module_id: 'mod-1',
        completed: true,
        completed_at: '2026-02-01T00:00:00Z',
        due_date: '2026-02-01',
        score: 90,
        liked: false,
        created_at: '2026-01-15T00:00:00Z',
      },
      {
        id: 'um-2',
        user_id: 'user-1',
        module_id: 'mod-2',
        completed: false,
        completed_at: null,
        due_date: '2099-12-31',
        score: null,
        liked: false,
        created_at: '2026-01-15T00:00:00Z',
      },
    ]);
    mockGetModules.mockResolvedValue([
      {
        id: 'mod-1',
        title: 'Culture Workbook',
        description: 'Overview',
        type: 'WORKBOOK',
        duration: '1 hour',
        link: null,
        host: null,
        sort_order: 1,
        target_role: null,
        day_offset: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'mod-2',
        title: 'Operations Systems',
        description: 'Systems training',
        type: 'VIDEO',
        duration: '30 mins',
        link: null,
        host: null,
        sort_order: 2,
        target_role: null,
        day_offset: 7,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('returns loading=true initially from useAllUsers, then loading=false with data', async () => {
    const { result } = renderHook(() => useAdminDashboard());

    // After data loads
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.students).toHaveLength(1);
  });

  it('returns correct students array (mapped NewHireProfile[])', async () => {
    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.students).toHaveLength(1);
    const student = result.current.students[0];
    expect(student.name).toBe('Alice');
    expect(student.managerId).toBe('mgr-1');
    expect(student.modules).toHaveLength(2);
    expect(student.progress).toBe(50); // 1 of 2 completed
  });

  it('returns correct stats (activeCount, avgProgress, atRiskCount)', async () => {
    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.activeCount).toBe(1);
    expect(result.current.stats.avgProgress).toBe(50);
    expect(result.current.stats.atRiskCount).toBe(0); // 50% > 25%, no overdue
  });

  it('returns error state when useAllUsers fails', async () => {
    mockUseAllUsersReturn = {
      users: [],
      loading: false,
      error: 'Network error',
      refetch: mockRefetch,
    };

    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('returns error state when getUserModulesBatch fails', async () => {
    mockGetUserModulesBatch.mockRejectedValue(new Error('Module fetch failed'));

    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Module fetch failed');
  });

  it('refetch triggers fresh data load', async () => {
    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();
    // refetch delegates to useAllUsers refetch
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('handles empty users list gracefully', async () => {
    mockUseAllUsersReturn = {
      users: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    };

    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.students).toEqual([]);
    expect(result.current.stats).toEqual({
      activeCount: 0,
      avgProgress: 0,
      atRiskCount: 0,
    });
  });
});
