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
 * Avatar colours: green, blue, orange, in that order.
 *
 * Gradients rather than flat fills — at this size a solid disc of colour reads as
 * a status dot, while a gradient reads as a person. White initials on a saturated
 * background also keep contrast identical in light and dark themes, which a tinted
 * background could not promise.
 */
const TONES = [
  'from-emerald-500 to-green-600',
  'from-sky-500 to-blue-600',
  'from-amber-500 to-orange-600',
] as const;

/**
 * Colour for a person with no position to speak of — a comment author, a sprint
 * lead, a roster row. Hashed from their id so it is at least stable: the same
 * person keeps the same colour every time they appear on their own.
 */
export function avatarTone(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
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
  index,
  className,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  /**
   * Position in a group. Given one, the colour comes straight from `TONES` — so
   * the first avatar is green, the second blue, the third orange, every time.
   * Without one there is no group to be positioned in, so it falls back to the
   * per-person hash.
   */
  index?: number;
  className?: string;
}) {
  const tone =
    index === undefined ? avatarTone(person.id || person.name) : TONES[index % TONES.length];

  return (
    <span
      title={person.email ? `${person.name} · ${person.email}` : person.name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white',
        // The display serif — the same face the landing page sets its headings in.
        // Instrument Serif ships a single 400 weight, so `font-bold` alone would
        // change nothing here: the stroke is what actually thickens the letters.
        'font-display font-bold leading-none tracking-wide [-webkit-text-stroke:0.4px_currentColor]',
        'shadow-sm ring-2 ring-surface',
        tone,
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
        <Avatar key={person.id} person={person} index={i} className={cn(i > 0 && '-ml-2')} />
      ))}
      {hidden > 0 && (
        <span className="-ml-2 flex h-[26px] items-center justify-center rounded-full bg-elevated px-1.5 font-display text-[11px] leading-none text-ink-soft ring-2 ring-surface">
          +{hidden}
        </span>
      )}
    </span>
  );
}
