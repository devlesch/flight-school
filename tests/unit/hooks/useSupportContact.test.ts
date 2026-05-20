import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Profile } from '../../../types/database';

const mockGetProfile = vi.fn();
const mockGetProfileByName = vi.fn();

vi.mock('../../../services/profileService', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  getProfileByName: (...args: unknown[]) => mockGetProfileByName(...args),
}));

const { useSupportContact } = await import('../../../hooks/useSupportContact');
const { SUPPORT_FALLBACK_NAME } = await import('../../../constants');

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p-1',
    email: 'p1@industriousoffice.com',
    name: 'Test User',
    role: 'New Hire',
    avatar: null,
    title: 'MXM',
    region: 'East',
    location: null,
    standardized_role: 'Member Experience Manager',
    manager_id: null,
    department: 'Experience',
    start_date: null,
    provisioned: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const signedInUserWithManager = makeProfile({ id: 'nh-1', manager_id: 'mgr-1' });
const signedInUserNoManager = makeProfile({ id: 'nh-2', manager_id: null });

const managerProfile = makeProfile({
  id: 'mgr-1',
  name: 'Jane Manager',
  email: 'jane.manager@industriousoffice.com',
  role: 'Manager',
  manager_id: null,
});

const fallbackProfile = makeProfile({
  id: 'mz-1',
  name: 'Melissa Zelko',
  email: 'melissa.zelko@industriousoffice.com',
  role: 'Manager',
  title: 'People Ops Lead',
});

describe('useSupportContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves with source=manager when manager_id resolves to a profile', async () => {
    mockGetProfile.mockResolvedValue(managerProfile);

    const { result } = renderHook(() => useSupportContact(signedInUserWithManager));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfile).toHaveBeenCalledWith('mgr-1');
    expect(mockGetProfileByName).not.toHaveBeenCalled();
    expect(result.current.source).toBe('manager');
    expect(result.current.contact).toEqual(managerProfile);
    expect(result.current.error).toBeNull();
  });

  it('resolves with source=fallback when manager_id is null and name lookup hits', async () => {
    mockGetProfileByName.mockResolvedValue(fallbackProfile);

    const { result } = renderHook(() => useSupportContact(signedInUserNoManager));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // useManager short-circuits on null managerId — getProfile must not be called.
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(mockGetProfileByName).toHaveBeenCalledWith(SUPPORT_FALLBACK_NAME);
    expect(result.current.source).toBe('fallback');
    expect(result.current.contact).toEqual(fallbackProfile);
    expect(result.current.error).toBeNull();
  });

  it('falls back when manager_id is set but getProfile returns null', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockGetProfileByName.mockResolvedValue(fallbackProfile);

    const { result } = renderHook(() => useSupportContact(signedInUserWithManager));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfile).toHaveBeenCalledWith('mgr-1');
    expect(mockGetProfileByName).toHaveBeenCalledWith(SUPPORT_FALLBACK_NAME);
    expect(result.current.source).toBe('fallback');
    expect(result.current.contact).toEqual(fallbackProfile);
    expect(result.current.error).toBeNull();
  });

  it('resolves with source=none when both manager and fallback miss', async () => {
    mockGetProfileByName.mockResolvedValue(null);

    const { result } = renderHook(() => useSupportContact(signedInUserNoManager));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfileByName).toHaveBeenCalledWith(SUPPORT_FALLBACK_NAME);
    expect(result.current.source).toBe('none');
    expect(result.current.contact).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error when the manager tier (getProfile) rejects', async () => {
    const boom = new Error('manager tier exploded');
    mockGetProfile.mockRejectedValue(boom);

    const { result } = renderHook(() => useSupportContact(signedInUserWithManager));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfile).toHaveBeenCalledWith('mgr-1');
    // Manager-tier error must NOT silently fall through to the fallback tier;
    // the error is surfaced.
    expect(mockGetProfileByName).not.toHaveBeenCalled();
    expect(result.current.source).toBe('none');
    expect(result.current.contact).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('manager tier exploded');
  });

  it('surfaces an error when the fallback tier (getProfileByName) rejects', async () => {
    const boom = new Error('fallback tier exploded');
    mockGetProfileByName.mockRejectedValue(boom);

    const { result } = renderHook(() => useSupportContact(signedInUserNoManager));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfileByName).toHaveBeenCalledWith(SUPPORT_FALLBACK_NAME);
    expect(result.current.source).toBe('none');
    expect(result.current.contact).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('fallback tier exploded');
  });

  it('does not call getProfile when profile is null/undefined', async () => {
    mockGetProfileByName.mockResolvedValue(null);

    const { result } = renderHook(() => useSupportContact(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetProfile).not.toHaveBeenCalled();
    // No manager_id → fallback tier runs; with no fallback profile → source=none.
    expect(result.current.source).toBe('none');
    expect(result.current.contact).toBeNull();
  });
});
