/**
 * Format a date string as "March 3rd, 2026"
 */
export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : '')) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const suffix = getDaySuffix(day);

  return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
}

/**
 * A task is overdue only once we're past its due date — i.e. starting the day
 * AFTER the due date, never on the due date itself.
 */
export function isOverdue(dueDate: string | Date): boolean {
  const due = typeof dueDate === 'string'
    ? new Date(dueDate + (dueDate.length === 10 ? 'T00:00:00' : ''))
    : dueDate;
  if (isNaN(due.getTime())) return false;

  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return dueMidnight < startOfToday;
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
