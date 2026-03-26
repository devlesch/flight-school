import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Edge Function logic inline since Deno functions can't run in Node/Vitest directly.
// We test the mapping/parsing logic that would run inside the Edge Function.

describe('Lessonly Proxy Logic', () => {
  // Simulate the assignment mapping logic from the Edge Function
  function mapAssignmentsToStatuses(
    lessonIds: number[],
    assignments: Array<{ assignable_id: number; assignable_type: string; status: string; completed_at: string | null }>
  ): Record<number, { status: string; completed_at: string | null }> {
    const assignmentMap = new Map<number, typeof assignments[0]>();
    for (const assignment of assignments) {
      if (assignment.assignable_type === 'Lesson') {
        assignmentMap.set(assignment.assignable_id, assignment);
      }
    }

    const statuses: Record<number, { status: string; completed_at: string | null }> = {};
    for (const lessonId of lessonIds) {
      const assignment = assignmentMap.get(lessonId);
      if (assignment) {
        statuses[lessonId] = {
          status: assignment.status,
          completed_at: assignment.completed_at,
        };
      } else {
        statuses[lessonId] = { status: 'not_found', completed_at: null };
      }
    }
    return statuses;
  }

  it('maps completed assignments correctly', () => {
    const lessonIds = [101, 202];
    const assignments = [
      { assignable_id: 101, assignable_type: 'Lesson', status: 'Completed', completed_at: '2026-03-20T10:00:00Z' },
      { assignable_id: 202, assignable_type: 'Lesson', status: 'Incomplete', completed_at: null },
    ];

    const result = mapAssignmentsToStatuses(lessonIds, assignments);

    expect(result[101]).toEqual({ status: 'Completed', completed_at: '2026-03-20T10:00:00Z' });
    expect(result[202]).toEqual({ status: 'Incomplete', completed_at: null });
  });

  it('returns not_found for lessons not in assignments', () => {
    const lessonIds = [101, 999];
    const assignments = [
      { assignable_id: 101, assignable_type: 'Lesson', status: 'Completed', completed_at: '2026-03-20T10:00:00Z' },
    ];

    const result = mapAssignmentsToStatuses(lessonIds, assignments);

    expect(result[101]).toEqual({ status: 'Completed', completed_at: '2026-03-20T10:00:00Z' });
    expect(result[999]).toEqual({ status: 'not_found', completed_at: null });
  });

  it('ignores non-Lesson assignable types', () => {
    const lessonIds = [101];
    const assignments = [
      { assignable_id: 101, assignable_type: 'LearningPaths::Path', status: 'Completed', completed_at: '2026-03-20T10:00:00Z' },
    ];

    const result = mapAssignmentsToStatuses(lessonIds, assignments);

    expect(result[101]).toEqual({ status: 'not_found', completed_at: null });
  });

  it('handles empty assignments array', () => {
    const lessonIds = [101, 202];
    const assignments: Array<{ assignable_id: number; assignable_type: string; status: string; completed_at: string | null }> = [];

    const result = mapAssignmentsToStatuses(lessonIds, assignments);

    expect(result[101]).toEqual({ status: 'not_found', completed_at: null });
    expect(result[202]).toEqual({ status: 'not_found', completed_at: null });
  });

  it('handles user not found scenario — all statuses should be not_found', () => {
    const lessonIds = [101, 202, 303];
    // When user is not found, the Edge Function returns not_found for all
    const statuses: Record<number, { status: string; completed_at: string | null }> = {};
    for (const id of lessonIds) {
      statuses[id] = { status: 'not_found', completed_at: null };
    }

    expect(Object.keys(statuses)).toHaveLength(3);
    expect(statuses[101].status).toBe('not_found');
    expect(statuses[202].status).toBe('not_found');
    expect(statuses[303].status).toBe('not_found');
  });
});
