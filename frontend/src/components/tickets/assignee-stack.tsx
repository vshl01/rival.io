import type { Person } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Initials from a display name — one letter per word, up to two.
 *
 * "Devon Demo" → DD, "vishal" → VI. Word initials beat the first two characters
 * because "de" reads as noise while "DD" reads as a person.
 */
export const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

/**
 * Avatar colours.
 *
 * Gradients rather than flat fills: at this size a solid disc of colour reads as a
 * status dot, while a gradient reads as a person. White initials on a saturated
 * background also keep contrast identical in light and dark themes, which a tinted
 * background could not promise.
 */
const GRADIENTS = [
  'from-violet-500 to-indigo-500',
  'from-sky-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-amber-400 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-blue-500 to-indigo-600',
  'from-teal-500 to-emerald-400',
  'from-fuchsia-500 to-purple-500',
] as const;

/**
 * Pick a gradient for a person, stably.
 *
 * Hashed from their id rather than taken from their position in the list, so one
 * person is the same colour on every card and in every stack. Position would mean
 * everybody's colour shifted the moment somebody else was assigned — the exact
 * thing that stops a colour being recognisable at a glance. Ids differ within a
 * stack, so the avatars still come out in different colours side by side.
 */
export function avatarGradient(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

const SIZES = {
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-[26px] w-[26px] text-[12px]',
  lg: 'h-8 w-8 text-[13px]',
} as const;

/** One person, rendered identically everywhere they appear. */
export function Avatar({
  person,
  size = 'md',
  className,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      title={person.email ? `${person.name} · ${person.email}` : person.name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white',
        // The display serif — the same face the landing page sets its headings in.
        'font-display leading-none tracking-wide',
        'shadow-sm ring-2 ring-surface',
        avatarGradient(person.id || person.name),
        SIZES[size],
        className,
      )}
    >
      {initials(person.name)}
    </span>
  );
}

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
 *
 * An unassigned ticket says so rather than rendering nothing. Blank space reads as
 * "still loading", and unassigned work is precisely what someone scanning a board
 * is looking for.
 */
export function AssigneeStack({ assignees, max = 3, className }: AssigneeStackProps) {
  if (assignees.length === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-dashed border-line px-2 py-1',
          'text-[10px] leading-none text-ink-faint',
          className,
        )}
      >
        Not assigned yet
      </span>
    );
  }

  const shown = assignees.slice(0, max);
  const hidden = assignees.length - shown.length;

  return (
    <span
      className={cn('flex items-center', className)}
      title={assignees.map((a) => a.name).join(', ')}
    >
      {shown.map((person, i) => (
        // Negative margin overlaps them; the ring keeps each one legible.
        <Avatar key={person.id} person={person} className={cn(i > 0 && '-ml-2')} />
      ))}
      {hidden > 0 && (
        <span className="-ml-2 flex h-[26px] items-center justify-center rounded-full bg-elevated px-1.5 font-display text-[11px] leading-none text-ink-soft ring-2 ring-surface">
          +{hidden}
        </span>
      )}
    </span>
  );
}
