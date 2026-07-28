'use client';

import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateSprintModal } from '@/components/sprints/create-sprint-modal';
import { SprintCard } from '@/components/sprints/sprint-card';
import type { Cycle } from '@/lib/types';
import { cn } from '@/lib/utils';

/** "2026-07" → "July 2026". */
export function cycleLabel(cycle: string): string {
  const [year, month] = cycle.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface CycleBlockProps {
  orgSlug: string;
  cycle: Cycle;
  /** The first block in the window is the month we are in. */
  isCurrent: boolean;
  canCreate: boolean;
}

/**
 * One month, holding the sprints filed under it.
 *
 * Collapsible, and only the month actually in progress opens by default: the
 * rolling window is three months, so two of them are always plans rather than
 * work. Showing all three expanded put the current sprints — the only ones anyone
 * needs at a glance — halfway down the column.
 *
 * Collapsing is per-visit state on purpose. It is not a preference worth
 * persisting; "the current month is open" should be true every time the page
 * loads, including at month rollover, when yesterday's choice would be wrong.
 */
export function CycleBlock({ orgSlug, cycle, isCurrent, canCreate }: CycleBlockProps) {
  const [open, setOpen] = useState(isCurrent);
  const [createOpen, setCreateOpen] = useState(false);

  const label = cycleLabel(cycle.cycle);
  const count = cycle.sprints.length;
  const overdue = cycle.sprints.filter(
    (s) => new Date(s.deadline).getTime() < Date.now() && s.number !== 0,
  ).length;

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        isCurrent ? 'border-accent/40 bg-accent/[0.03]' : 'border-line bg-canvas',
      )}
    >
      <div className="flex items-center gap-1 pr-1.5">
        {/* The whole row toggles, so the target is the width of the block. */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-2 text-left"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform',
              open && 'rotate-90',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'shrink-0 font-display text-[15px] leading-none',
              isCurrent ? 'text-ink' : 'text-ink-soft',
            )}
          >
            {label}
          </span>
          {isCurrent && (
            <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
              now
            </span>
          )}

          {/* Collapsed months still have to say whether anything is in them. */}
          <span className="min-w-0 truncate text-[11px] text-ink-faint">
            {count === 0 ? 'empty' : `${count} ${count === 1 ? 'sprint' : 'sprints'}`}
            {overdue > 0 && <span className="text-danger"> · {overdue} overdue</span>}
          </span>
        </button>

        {canCreate && (
          <button
            onClick={() => {
              // Expand as well, or the sprint you just created lands out of sight.
              setOpen(true);
              setCreateOpen(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-ink-faint transition-colors hover:bg-elevated hover:text-ink"
          >
            <Plus className="h-3 w-3" />
            Sprint
          </button>
        )}
      </div>

      {open && (
        <div className="px-1.5 pb-1.5">
          {count === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-faint">
              {canCreate
                ? `Nothing planned for ${label} yet.`
                : `No sprints in ${label}.`}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {cycle.sprints.map((sprint) => (
                <SprintCard key={sprint.id} orgSlug={orgSlug} cycle={cycle.cycle} sprint={sprint} />
              ))}
            </ul>
          )}
        </div>
      )}

      <CreateSprintModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgSlug={orgSlug}
        cycle={cycle.cycle}
        cycleLabel={label}
      />
    </section>
  );
}
