'use client';

import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateSprintModal } from '@/components/sprints/create-sprint-modal';
import { SprintCard } from '@/components/sprints/sprint-card';
import { Button } from '@/components/ui/button';
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

/** One month, holding the sprints filed under it. */
export function CycleBlock({ orgSlug, cycle, isCurrent, canCreate }: CycleBlockProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const label = cycleLabel(cycle.cycle);

  return (
    <section
      className={cn(
        'rounded-2xl border bg-surface p-5',
        isCurrent ? 'border-accent/30' : 'border-line',
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarDays
            className={cn('h-4 w-4', isCurrent ? 'text-accent' : 'text-ink-faint')}
          />
          <h2 className="font-display text-xl leading-none text-ink">{label}</h2>
          {isCurrent && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              now
            </span>
          )}
        </div>

        {canCreate && (
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Sprint
          </Button>
        )}
      </header>

      {cycle.sprints.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
          {canCreate
            ? 'No sprints yet — add one to start planning this month.'
            : 'No sprints this month.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {cycle.sprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              orgSlug={orgSlug}
              cycle={cycle.cycle}
              sprint={sprint}
            />
          ))}
        </ul>
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
