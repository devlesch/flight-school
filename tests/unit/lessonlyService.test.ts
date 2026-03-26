import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseLessonlyId } from '../../services/lessonlyService';

// Mock supabase before importing getLessonlyStatuses
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { getLessonlyStatuses } from '../../services/lessonlyService';
import { supabase } from '../../lib/supabase';

describe('parseLessonlyId', () => {
  it('extracts lesson ID from standard URL', () => {
    expect(parseLessonlyId('https://app.lessonly.com/lesson/123')).toBe(123);
  });

  it('extracts lesson ID from subdomain URL', () => {
    expect(parseLessonlyId('https://industrious.lessonly.com/lesson/456')).toBe(456);
  });

  it('extracts lesson ID from URL with trailing slug', () => {
    expect(parseLessonlyId('https://app.lessonly.com/lesson/789/some-slug')).toBe(789);
  });

  it('returns null for non-Lessonly URL', () => {
    expect(parseLessonlyId('https://docs.google.com/presentation/123')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseLessonlyId('')).toBeNull();
  });

  it('returns null for Lessonly URL without lesson path', () => {
    expect(parseLessonlyId('https://app.lessonly.com/dashboard')).toBeNull();
  });

  it('handles URL with query params after lesson ID', () => {
    expect(parseLessonlyId('https://app.lessonly.com/lesson/321?ref=email')).toBe(321);
  });
});

describe('getLessonlyStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns statuses on successful proxy call', async () => {
    const mockResponse = {
      success: true,
      lessonly_user_found: true,
      statuses: {
        101: { status: 'Completed', completed_at: '2026-03-20T10:00:00Z' },
        202: { status: 'Incomplete', completed_at: null },
      },
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: mockResponse,
      error: null,
    });

    const result = await getLessonlyStatuses('test@industriousoffice.com', [101, 202]);

    expect(result.success).toBe(true);
    expect(result.lessonly_user_found).toBe(true);
    expect(result.statuses[101].status).toBe('Completed');
    expect(result.statuses[202].status).toBe('Incomplete');
  });

  it('returns error response when proxy fails', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Edge Function error' },
    });

    const result = await getLessonlyStatuses('test@industriousoffice.com', [101]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Edge Function error');
  });

  it('handles network exceptions gracefully', async () => {
    vi.mocked(supabase.functions.invoke).mockRejectedValue(new Error('Network timeout'));

    const result = await getLessonlyStatuses('test@industriousoffice.com', [101]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });
});
