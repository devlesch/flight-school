import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrainingModule } from '../../types/database';

// Mock Supabase client
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockEq = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ insert: mockInsert, update: mockUpdate }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Import after mocking
const { createModule, updateModule } = await import('../../services/moduleService');

const mockModule: TrainingModule = {
  id: 'test-uuid-123',
  title: 'Member Crisis Resolution',
  description: null,
  type: 'LIVE_CALL',
  duration: null,
  link: 'https://app.lessonly.com/lesson/123',
  host: null,
  sort_order: 0,
  target_role: 'MXM',
  day_offset: 0,
  created_at: '2026-03-02T00:00:00Z',
};

describe('createModule()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it('inserts a record and returns the created TrainingModule on success', async () => {
    mockSingle.mockResolvedValue({ data: mockModule, error: null });

    const input: TrainingModule['Insert'] = {
      title: 'Member Crisis Resolution',
      type: 'LIVE_CALL',
      link: 'https://app.lessonly.com/lesson/123',
      target_role: 'MXM',
    };

    const result = await createModule(input);

    expect(mockFrom).toHaveBeenCalledWith('training_modules');
    expect(mockInsert).toHaveBeenCalledWith(input);
    expect(result).toEqual(mockModule);
  });

  it('returns null and logs an error when Supabase returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const input: TrainingModule['Insert'] = {
      title: 'Test Module',
      type: 'WORKBOOK',
    };

    const result = await createModule(input);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error creating module:',
      'DB error'
    );
    consoleSpy.mockRestore();
  });

  it('accepts null for target_role (All Roles case)', async () => {
    mockSingle.mockResolvedValue({ data: { ...mockModule, target_role: null }, error: null });

    const input: TrainingModule['Insert'] = {
      title: 'All Roles Module',
      type: 'MANAGER_LED',
      target_role: null,
    };

    const result = await createModule(input);

    expect(mockInsert).toHaveBeenCalledWith(input);
    expect(result?.target_role).toBeNull();
  });
});

describe('updateModule()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it('updates a record and returns the updated TrainingModule on success', async () => {
    const updatedModule = { ...mockModule, title: 'Updated Title' };
    mockSingle.mockResolvedValue({ data: updatedModule, error: null });

    const result = await updateModule('test-uuid-123', { title: 'Updated Title' });

    expect(mockFrom).toHaveBeenCalledWith('training_modules');
    expect(mockUpdate).toHaveBeenCalledWith({ title: 'Updated Title' });
    expect(mockEq).toHaveBeenCalledWith('id', 'test-uuid-123');
    expect(result).toEqual(updatedModule);
  });

  it('returns null and logs an error when Supabase returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

    const result = await updateModule('test-uuid-123', { title: 'Fail' });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error updating module:',
      'Update failed'
    );
    consoleSpy.mockRestore();
  });
});
