import { supabase } from '../lib/supabase';

export interface LessonlyStatus {
  status: 'Completed' | 'Incomplete' | 'not_found';
  completed_at: string | null;
}

export interface LessonlyStatusResponse {
  success: boolean;
  lessonly_user_found: boolean;
  statuses: Record<number, LessonlyStatus>;
  error?: string;
}

/**
 * Parse a Lessonly lesson ID from a module URL.
 * Handles formats like:
 *   https://app.lessonly.com/lesson/123
 *   https://industrious.lessonly.com/lesson/456
 *   https://app.lessonly.com/lesson/789/some-slug
 */
export function parseLessonlyId(link: string): number | null {
  const match = link.match(/lessonly\.com\/lesson\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fetch completion statuses for Lessonly lessons via the Edge Function proxy.
 */
export async function getLessonlyStatuses(
  email: string,
  lessonIds: number[]
): Promise<LessonlyStatusResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('lessonly-proxy', {
      body: { email, lessonIds },
    });

    if (error) {
      console.error('Lessonly proxy error:', error.message);
      return {
        success: false,
        lessonly_user_found: false,
        statuses: {},
        error: error.message,
      };
    }

    return data as LessonlyStatusResponse;
  } catch (err) {
    console.error('Lessonly service error:', err);
    return {
      success: false,
      lessonly_user_found: false,
      statuses: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
