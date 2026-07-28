import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { formatDue } from '@/lib/format';
import type { Sprint } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SprintCardProps {
  orgSlug: string;
  /** `2026-07` — needed for the link, since numbers are unique per cycle. */
  cycle: string;
  sprint: Sprint;
}

/** One sprint in a month block. Links to /dashboard/{org}/{cycle}/{number}. */
export function SprintCard({ orgSlug, cycle, sprint }: SprintCardProps) {
  const due = formatDue(sprint.deadline);

  return (
    <li>
      <Link
        href={`/dashboard/${orgSlug}/${cycle}/${sprint.number}`}
        className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-3 transition-all hover:border-ink-faint/40 hover:shadow-soft"
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* The sprint's identity, and what appears in its URL. */}
          <span className="shrink-0 rounded-lg border border-line bg-elevated px-2 py-1 font-mono text-xs text-ink-soft">
            #{sprint.number}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{sprint.name}</p>
            <p className="truncate text-xs text-ink-faint">led by {sprint.assigner.name}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {due && (
            <span
              className={cn(
                'text-xs',
                due.overdue ? 'text-danger' : due.soon ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {due.overdue ? 'overdue ' : 'due '}
              {due.label}
            </span>
          )}
          <ArrowUpRight className="h-4 w-4 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </Link>
    </li>
  );
}
