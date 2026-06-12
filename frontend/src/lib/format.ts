import { differenceInCalendarDays, format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';

/** Human-friendly due date with an overdue flag for styling. */
export function formatDue(iso: string | null): { label: string; overdue: boolean; soon: boolean } | null {
  if (!iso) return null;
  const date = new Date(iso);
  const days = differenceInCalendarDays(date, new Date());
  const overdue = days < 0;
  const soon = days >= 0 && days <= 1;

  let label: string;
  if (isToday(date)) label = 'Today';
  else if (isTomorrow(date)) label = 'Tomorrow';
  else if (isYesterday(date)) label = 'Yesterday';
  else if (days > 0 && days < 7) label = format(date, 'EEEE');
  else label = format(date, 'MMM d');

  return { label, overdue, soon };
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function formatFullDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
