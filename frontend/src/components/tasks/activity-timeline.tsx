import {
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { formatRelative } from '@/lib/format';
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META } from '@/lib/task-meta';
import type { Activity, Priority, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The audit trail, read as sentences rather than as event names.
 *
 * "updated the ticket" is technically true and practically useless — the whole
 * reason the trail records a field-level diff is so it can say *what* moved
 * where. Every line here is rendered from `metadata.changes`, so a status move
 * reads "moved it Scoping → In progress" with the real state colours, and a
 * reassignment names the people.
 *
 * Rendering, not storage: the server keeps the diff and nothing else, so
 * improving these sentences never needs a migration and applies to history that
 * was written long before this file existed.
 */

/** One field's before/after, as stored by the backend's `diffChanges`. */
interface Change {
  from: unknown;
  to: unknown;
}

type Changes = Partial<Record<string, Change>>;

const changesOf = (activity: Activity): Changes =>
  ((activity.metadata as { changes?: Changes } | null)?.changes ?? {}) as Changes;

const isStatus = (v: unknown): v is TaskStatus => typeof v === 'string' && v in STATUS_META;
const isPriority = (v: unknown): v is Priority => typeof v === 'string' && v in PRIORITY_META;

/** `12 Aug` — short enough to sit inside a sentence. */
const shortDate = (iso: unknown) =>
  typeof iso === 'string'
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

/** A state or priority rendered as its own chip, so the colour carries meaning. */
function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium leading-4',
        className,
      )}
    >
      {label}
    </span>
  );
}

function Moved({ from, to }: { from: unknown; to: unknown }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {isStatus(from) && <Pill label={STATUS_META[from].label} className={STATUS_META[from].chip} />}
      <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
      {isStatus(to) && <Pill label={STATUS_META[to].label} className={STATUS_META[to].chip} />}
    </span>
  );
}

/** Quoted and clipped — a renamed title can be 200 characters. */
function Quoted({ value }: { value: unknown }) {
  const text = typeof value === 'string' && value.length > 0 ? value : '—';
  return (
    <span className="text-ink" title={text}>
      “{text.length > 40 ? `${text.slice(0, 40)}…` : text}”
    </span>
  );
}

interface Line {
  icon: LucideIcon;
  /** Rail colour, so the shape of a busy timeline reads at a glance. */
  tone: string;
  body: React.ReactNode;
}

/** The single most significant thing this activity says, plus any extras. */
function toLine(activity: Activity): Line {
  const changes = changesOf(activity);
  const meta = (activity.metadata ?? {}) as { name?: string; key?: string; added?: string[]; removed?: string[] };
  const kind = activity.action.startsWith('ticket.') ? 'ticket' : 'task';

  switch (activity.action) {
    case 'task.created':
    case 'ticket.created':
      return {
        icon: Plus,
        tone: 'bg-accent',
        body: <>created this {kind}{meta.key ? ` as ${meta.key}` : ''}</>,
      };

    case 'ticket.assignees_changed': {
      const added = meta.added ?? [];
      const removed = meta.removed ?? [];
      return {
        icon: Users,
        tone: 'bg-medium',
        body: (
          <>
            {added.length > 0 && <>assigned <span className="text-ink">{added.join(', ')}</span></>}
            {added.length > 0 && removed.length > 0 && ' and '}
            {removed.length > 0 && (
              <>unassigned <span className="text-ink">{removed.join(', ')}</span></>
            )}
          </>
        ),
      };
    }

    case 'comment.added':
      return { icon: MessageSquare, tone: 'bg-low', body: <>left a comment</> };

    case 'attachment.added':
      return {
        icon: Paperclip,
        tone: 'bg-low',
        body: <>attached {meta.name ? <span className="text-ink">{meta.name}</span> : 'a file'}</>,
      };

    case 'attachment.removed':
      return {
        icon: Paperclip,
        tone: 'bg-ink-faint',
        body: <>removed {meta.name ? <span className="text-ink">{meta.name}</span> : 'an attachment'}</>,
      };
  }

  // Everything else is an update, described by whichever field moved.
  const status = changes.status;
  if (status) {
    const done = isStatus(status.to) && status.to === 'DONE';
    return {
      icon: done ? CheckCircle2 : ArrowRight,
      tone: done ? 'bg-accent' : 'bg-medium',
      body: (
        <>
          moved it <Moved from={status.from} to={status.to} />
        </>
      ),
    };
  }

  if (changes.title) {
    return {
      icon: Pencil,
      tone: 'bg-ink-faint',
      body: (
        <>
          renamed it from <Quoted value={changes.title.from} /> to <Quoted value={changes.title.to} />
        </>
      ),
    };
  }

  if (changes.priority) {
    const { from, to } = changes.priority;
    // PRIORITY_ORDER runs URGENT → LOW, so a SMALLER index is more urgent.
    const direction =
      isPriority(from) && isPriority(to)
        ? PRIORITY_ORDER.indexOf(to) < PRIORITY_ORDER.indexOf(from)
          ? 'raised'
          : 'lowered'
        : 'changed';
    return {
      icon: Pencil,
      tone: 'bg-high',
      body: (
        <>
          {direction} priority to{' '}
          {isPriority(to) && <Pill label={PRIORITY_META[to].label} className={PRIORITY_META[to].chip} />}
        </>
      ),
    };
  }

  if (changes.dueDate) {
    const to = shortDate(changes.dueDate.to);
    const from = shortDate(changes.dueDate.from);
    return {
      icon: Pencil,
      tone: 'bg-ink-faint',
      body: to ? (
        <>
          {from ? `moved the due date to ${to}` : `set the due date to ${to}`}
        </>
      ) : (
        <>cleared the due date</>
      ),
    };
  }

  if (changes.description) {
    return { icon: Pencil, tone: 'bg-ink-faint', body: <>edited the description</> };
  }

  const fields = Object.keys(changes);
  return {
    icon: Pencil,
    tone: 'bg-ink-faint',
    body: <>{fields.length ? `changed ${fields.join(', ')}` : `updated the ${kind}`}</>,
  };
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (!activities.length) {
    return <p className="mt-2 text-sm text-ink-faint">No activity yet.</p>;
  }

  return (
    <ol className="mt-3 space-y-0">
      {activities.map((activity, i) => {
        const { icon: Icon, tone, body } = toLine(activity);
        return (
          <li key={activity.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-canvas',
                  tone,
                )}
              >
                <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              </span>
              {i < activities.length - 1 && <span className="my-1 w-px flex-1 bg-line" />}
            </div>

            <div className="min-w-0 pb-1">
              <p className="text-sm leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">{activity.actor?.name ?? 'Someone'}</span>{' '}
                {body}
              </p>
              <p className="text-xs text-ink-faint">{formatRelative(activity.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
