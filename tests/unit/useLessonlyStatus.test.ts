import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLessonlyStatus } from '../../hooks/useLessonlyStatus';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '../../lib/supabase';

const mockModules = [
  { id: 'mod-1', type: 'LESSONLY', link: 'https://app.lessonly.com/lesson/101' },
  { id: 'mod-2', type: 'LESSONLY', link: 'https://app.lessonly.com/lesson/202' },
  { id: 'mod-3', type: 'WORKBOOK', link: '' },
];

describe('useLessonlyStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty statuses when email is null', () => {
    const { result } = renderHook(() => useLessonlyStatus(null, mockModules));

    expect(result.current.statuses).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches and maps statuses for LESSONLY modules', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        success: true,
        lessonly_user_found: true,
        statuses: {
          101: { status: 'Completed', completed_at: '2026-03-20T10:00:00Z' },
          202: { status: 'Incomplete', completed_at: null },
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useLessonlyStatus('test@industriousoffice.com', mockModules)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.statuses['mod-1']).toEqual({
      status: 'Completed',
      completedAt: '2026-03-20T10:00:00Z',
    });
    expect(result.current.statuses['mod-2']).toEqual({
      status: 'Incomplete',
      completedAt: null,
    });
    // WORKBOOK module should not be in statuses
    expect(result.current.statuses['mod-3']).toBeUndefined();
  });

  it('sets error when proxy returns failure', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        success: false,
        lessonly_user_found: false,
        statuses: {},
        error: 'Lessonly credentials not configured',
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useLessonlyStatus('test@industriousoffice.com', mockModules)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Lessonly credentials not configured');
  });

  it('skips modules without parseable lesson IDs', () => {
    const modulesWithBadLinks = [
      { id: 'mod-1', type: 'LESSONLY', link: 'https://docs.google.com/doc/123' },
    ];

    const { result } = renderHook(() =>
      useLessonlyStatus('test@industriousoffice.com', modulesWithBadLinks)
    );

    expect(result.current.statuses).toEqual({});
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
