import { describe, it, expect } from 'vitest';
import { isOverdue } from '../../lib/formatDate';

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayOffset = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
};

describe('isOverdue', () => {
  it('is NOT overdue on the due date itself (same day)', () => {
    expect(isOverdue(dayOffset(0))).toBe(false);
  });

  it('IS overdue the day after the due date', () => {
    expect(isOverdue(dayOffset(-1))).toBe(true);
  });

  it('is NOT overdue when the due date is in the future', () => {
    expect(isOverdue(dayOffset(1))).toBe(false);
  });

  it('accepts a Date object and ignores its time component', () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    expect(isOverdue(today)).toBe(false);
  });

  it('returns false for an invalid date string', () => {
    expect(isOverdue('not-a-date')).toBe(false);
  });
});
