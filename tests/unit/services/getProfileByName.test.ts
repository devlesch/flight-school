import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Profile } from '../../../types/database';

// Mock Supabase client. The `getProfileByName` function chains:
//   supabase.from('profiles').select('*').ilike('name', name).maybeSingle()
const mockMaybeSingle = vi.fn();
const mockIlike = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ ilike: mockIlike }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(),
    },
  },
}));

const { getProfileByName } = await import('../../../services/profileService');

const mockProfile: Profile = {
  id: 'mz-1',
  email: 'melissa.zelko@industriousoffice.com',
  name: 'Melissa Zelko',
  role: 'Manager',
  avatar: null,
  title: 'People Ops Lead',
  region: 'East',
  location: null,
  standardized_role: 'People Ops',
  manager_id: null,
  department: 'People',
  start_date: null,
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('getProfileByName()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ ilike: mockIlike });
    mockIlike.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it('returns a Profile for an existing name', async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockProfile, error: null });

    const result = await getProfileByName('Melissa Zelko');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockIlike).toHaveBeenCalledWith('name', 'Melissa Zelko');
    expect(result).toEqual(mockProfile);
  });

  it('returns null for an unknown name (maybeSingle returns null data)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getProfileByName('Nobody Nowhere');

    expect(mockIlike).toHaveBeenCalledWith('name', 'Nobody Nowhere');
    expect(result).toBeNull();
  });

  it('returns null and logs when Supabase returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB down' } });

    const result = await getProfileByName('Melissa Zelko');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching profile by name:',
      'DB down'
    );
    consoleSpy.mockRestore();
  });

  it('uses ilike (case-insensitive) — call is forwarded with the literal name', async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockProfile, error: null });

    // Lower-cased input still hits the same row because Supabase ilike is
    // case-insensitive. We assert that we are calling `ilike` (not `eq`) and
    // that the name is passed through unchanged.
    await getProfileByName('melissa zelko');

    expect(mockIlike).toHaveBeenCalledWith('name', 'melissa zelko');
    // Sanity check: we did NOT use eq.
    const fromReturn = mockFrom.mock.results[0]?.value as { select?: unknown };
    expect(fromReturn).toBeDefined();
    expect(mockIlike).toHaveBeenCalledTimes(1);
  });

  it('short-circuits with null for empty/whitespace input (no Supabase call)', async () => {
    const result1 = await getProfileByName('');
    const result2 = await getProfileByName('   ');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
