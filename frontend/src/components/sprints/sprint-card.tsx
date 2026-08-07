import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/tickets/assignee-stack';
import { PENDING_SPRINT_NUMBER } from '@/hooks/use-sprints';
import { formatDue } from '@/lib/format';
import type { Sprint } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SprintCardProps {
  orgSlug: string;
  /** `2026-07` — needed for the link, since numbers are unique per cycle. */
  cycle: string;
  sprint: Sprint;
}

/** `1 Jul – 14 Jul` — the sprint's window, in the shortest readable form. */
const short = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

type Phase = 'upcoming' | 'running' | 'ended';

/**
 * Where the sprint is in its own window.
 *
 * Derived from the dates rather than stored: a status column would be a second
 * source of truth that drifts the moment a deadline moves, and this is the one
 * thing a month list has to communicate — which sprint is live right now.
 */
function phaseOf(sprint: Sprint): Phase {
  const now = Date.now();
  if (now < new Date(sprint.startsAt).getTime()) return 'upcoming';
  if (now > new Date(sprint.deadline).getTime()) return 'ended';
  return 'running';
}

const PHASE_DOT: Record<Phase, string> = {
  running: 'bg-accent',
  upcoming: 'bg-ink-faint/40',
  ended: 'bg-ink-faint/20',
};

/**
 * One sprint in a month block. Links to /dashboard/{org}/{cycle}/{number}.
 *
 * A single dense row: phase, identity, name, window, lead, deadline. Everything
 * else belongs on the sprint's own page — a month with six sprints has to stay
 * readable without scrolling.
 */
export function SprintCard({ orgSlug, cycle, sprint }: SprintCardProps) {
  const due = formatDue(sprint.deadline);
  // Optimistically added and still saving: its number comes from the server, so
  // there is nothing to link to yet.
  const pending = sprint.number === PENDING_SPRINT_NUMBER;
  const phase = phaseOf(sprint);
  const Row = pending ? 'div' : Link;

  return (
    <li>
      <Row
        href={`/dashboard/${orgSlug}/${cycle}/${sprint.number}`}
        className={cn(
          'group flex items-center gap-2.5 rounded-lg border bg-surface py-2 pl-2.5 pr-2 transition-all',
          pending
            ? 'animate-pulse border-dashed border-line'
            : 'border-line hover:border-accent/40 hover:shadow-soft',
          phase === 'ended' && !pending && 'opacity-75',
        )}
      >
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PHASE_DOT[phase])}
          title={phase === 'running' ? 'in progress' : phase}
          aria-hidden
        />

        {/* The sprint's identity, and what appears in its URL. */}
        <span className="shrink-0 font-mono text-[11px] leading-4 text-ink-faint">
          {pending ? 'saving…' : `#${sprint.number}`}
        </span>

        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
          {sprint.name}
        </span>

        <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-faint sm:inline">
          {short(sprint.startsAt)} – {short(sprint.deadline)}
        </span>

        {/* Initials rather than a full name: the lead matters, the column is narrow. */}
        <span className="hidden md:block" title={`led by ${sprint.assigner.name}`}>
          <Avatar person={sprint.assigner} size="sm" />
        </span>

        {due && (
          <span
            className={cn(
              'w-16 shrink-0 text-right text-[11px]',
              due.overdue ? 'font-medium text-danger' : due.soon ? 'text-ink' : 'text-ink-faint',
            )}
          >
            {due.overdue ? 'overdue' : due.label}
          </span>
        )}

        {!pending && (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
        )}
      </Row>
    </li>
  );
}
