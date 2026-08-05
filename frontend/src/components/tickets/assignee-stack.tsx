import type { Person } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Two initials from a display name. */
export const initials = (name: string) => name.slice(0, 2).toUpperCase();

interface AssigneeStackProps {
  assignees: Person[];
  /** Beyond this, the rest collapse into a "+n" chip. */
  max?: number;
  className?: string;
}

/**
 * Overlapping avatars. Shows who is on a ticket in the width of one avatar plus a
 * few pixels, which is the only way a card can stay dense once a ticket can have
 * several people on it.
 */
export function AssigneeStack({ assignees, max = 3, className }: AssigneeStackProps) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, max);
  const hidden = assignees.length - shown.length;

  return (
    <span
      className={cn('flex items-center', className)}
      title={assignees.map((a) => a.name).join(', ')}
    >
      {shown.map((person, i) => (
        <span
          key={person.id}
          // Negative margin overlaps them; the ring keeps each one legible.
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full bg-elevated text-[8px] font-medium text-ink-soft ring-1 ring-surface',
            i > 0 && '-ml-1',
          )}
        >
          {initials(person.name)}
        </span>
      ))}
      {hidden > 0 && (
        <span className="-ml-1 flex h-4 items-center justify-center rounded-full bg-elevated px-1 text-[8px] font-medium text-ink-faint ring-1 ring-surface">
          +{hidden}
        </span>
      )}
    </span>
  );
}
