import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Profile } from '../../types/database';

// Mock Supabase client
const mockOrder = vi.fn();
const mockIn = vi.fn(() => ({ order: mockOrder }));
const mockEq = vi.fn(() => ({ in: mockIn }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Import after mocking
const { getLeadershipByRegion } = await import('../../services/teamService');

const LEADERSHIP_ROLES = ['Regional Director', 'General Manager', 'Assistant General Manager'];

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

describe('getLeadershipByRegion()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ in: mockIn });
    mockIn.mockReturnValue({ order: mockOrder });
  });

  it('returns profiles filtered by region and standardized_role', async () => {
    mockOrder.mockResolvedValue({ data: [mockRD, mockGM], error: null });

    const result = await getLeadershipByRegion('North East');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('region', 'North East');
    expect(mockIn).toHaveBeenCalledWith('standardized_role', LEADERSHIP_ROLES);
    expect(result).toEqual([mockRD, mockGM]);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no matching profiles found', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const result = await getLeadershipByRegion('Antarctica');

    expect(result).toEqual([]);
  });

  it('returns empty array when Supabase returns null data', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null });

    const result = await getLeadershipByRegion('North East');

    expect(result).toEqual([]);
  });

  it('returns empty array and logs error on Supabase error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB connection failed' } });

    const result = await getLeadershipByRegion('North East');

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching leadership by region:',
      'DB connection failed'
    );
    consoleSpy.mockRestore();
  });
});
