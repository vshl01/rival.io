'use client';

import { Eye, EyeOff, Plus, Ticket as TicketIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import { CreateTicketModal } from '@/components/tickets/create-ticket-modal';
import { TicketCard } from '@/components/tickets/ticket-card';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import {
  isPendingTicket,
  useDeleteTicket,
  useSprintTickets,
  useUpdateTicket,
} from '@/hooks/use-tickets';
import { BOARD_COLUMNS, STATUS_META } from '@/lib/task-meta';
import type { Task, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWatchSprint } from '@/providers/socket-provider';

interface TicketBoardProps {
  orgSlug: string;
  cycle: string;
  sprint: number;
  /**
   * The sprint's real id, used to join its realtime room. The URL carries the
   * per-cycle number, which is not unique across the platform and so cannot key
   * a socket room.
   */
  sprintId: string;
  /** Delete is assigner-only server-side; the control is hidden for workers. */
  canDelete: boolean;
}

/**
 * The tickets in one sprint, as dense status columns.
 *
 * There is a single create entry point — every ticket enters in Scoping and is
 * dragged onward, so columns are destinations rather than inboxes. Status changes
 * go through an optimistic mutation: the card moves on drop and snaps back if the
 * server refuses.
 *
 * The board is shared, so it also watches its sprint's realtime room: a card
 * dragged by a colleague moves here too, without anyone reloading.
 */
export function TicketBoard({ orgSlug, cycle, sprint, sprintId, canDelete }: TicketBoardProps) {
  const [createIn, setCreateIn] = useState<TaskStatus | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  // Every member looking at this board gets the same events.
  useWatchSprint(sprintId);

  const { data: tickets, isLoading } = useSprintTickets(orgSlug, cycle, sprint);
  const update = useUpdateTicket(orgSlug, cycle, sprint);
  const remove = useDeleteTicket(orgSlug, cycle, sprint);

  /** Group once per data change rather than filtering per column on every render. */
  const byStatus = useMemo(() => {
    const groups = new Map<TaskStatus, Task[]>();
    for (const ticket of tickets ?? []) {
      const list = groups.get(ticket.status);
      if (list) list.push(ticket);
      else groups.set(ticket.status, [ticket]);
    }
    return groups;
  }, [tickets]);

  const removedCount = byStatus.get('REMOVED')?.length ?? 0;
  const columns = showRemoved ? [...BOARD_COLUMNS, 'REMOVED' as TaskStatus] : BOARD_COLUMNS;

  const modal = (
    <CreateTicketModal
      status={createIn}
      onClose={() => setCreateIn(null)}
      orgSlug={orgSlug}
      cycle={cycle}
      sprint={sprint}
    />
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-13.5rem)] gap-2 overflow-hidden">
        {BOARD_COLUMNS.map((s) => (
          <Skeleton key={s} className="h-full min-w-[248px] flex-1 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!tickets?.length) {
    return (
      <>
        <EmptyState
          icon={<TicketIcon className="h-5 w-5" />}
          title="No tickets yet"
          description="Anyone in the organisation can add the first one. It starts in Scoping."
          action={
            <Button size="sm" onClick={() => setCreateIn('SCOPING')}>
              <Plus className="h-3.5 w-3.5" />
              New ticket
            </Button>
          }
          className="rounded-xl border border-line bg-surface py-10"
        />
        {modal}
      </>
    );
  }

  return (
    <>
      {/* Board toolbar — count, removed toggle, and the one create button. */}
      <div className="flex items-center gap-3 pb-2">
        <span className="text-xs text-ink-faint">
          {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
        </span>

        {removedCount > 0 && (
          <button
            onClick={() => setShowRemoved((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-ink"
          >
            {showRemoved ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {removedCount} removed
          </button>
        )}

        <div className="ml-auto">
          <Button size="sm" onClick={() => setCreateIn('SCOPING')}>
            <Plus className="h-3.5 w-3.5" />
            New ticket
          </Button>
        </div>
      </div>

      {/*
        Columns fill the viewport below the nav + sticky header + this toolbar, so
        every column is the same height whether it holds one ticket or twenty —
        and each scrolls independently instead of stretching the page.
      */}
      <div className="flex h-[calc(100vh-13.5rem)] items-stretch gap-2 overflow-x-auto pb-2">
        {columns.map((status) => {
          const meta = STATUS_META[status];
          const items = byStatus.get(status) ?? [];
          const isTarget = dragOver === status;

          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver !== status) setDragOver(status);
              }}
              onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
              onDrop={(e) => {
                setDragOver(null);
                const id = e.dataTransfer.getData('text/ticket-id');
                const from = e.dataTransfer.getData('text/ticket-status');
                if (id && from !== status) update.mutate({ id, payload: { status } });
              }}
              className={cn(
                // Grows to share the width evenly, but never narrower than a
                // readable card — past that the row scrolls instead.
                'flex h-full min-w-[248px] flex-1 flex-col overflow-hidden rounded-xl border transition-colors',
                meta.column,
                isTarget && 'border-accent/60 bg-accent/[0.07]',
              )}
            >
              <header className="flex shrink-0 items-center gap-1.5 px-2.5 py-2">
                <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                  {meta.label}
                </h3>
                <span className="text-[11px] tabular-nums text-ink-faint">{items.length}</span>
              </header>

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1.5 pb-2">
                {items.length === 0 ? (
                  <p
                    className={cn(
                      'rounded-lg border border-dashed px-2 py-5 text-center text-[11px] transition-colors',
                      isTarget
                        ? 'border-accent/50 text-accent'
                        : 'border-line/60 text-ink-faint/70',
                    )}
                  >
                    Drop here
                  </p>
                ) : (
                  items.map((ticket) => {
                    // Still being created: it has no server id, so dragging it
                    // would send a PATCH for a row that does not exist yet.
                    const pending = isPendingTicket(ticket.id);
                    return (
                      <div
                        key={ticket.id}
                        draggable={!pending}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/ticket-id', ticket.id);
                          e.dataTransfer.setData('text/ticket-status', ticket.status);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <TicketCard
                          ticket={ticket}
                          canDelete={canDelete}
                          onDelete={(id) => remove.mutate(id)}
                          deleting={remove.isPending && remove.variables === ticket.id}
                          pending={pending}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {modal}
      {/* The same drawer personal tasks use — comments, activity, attachments. */}
      <TaskDetailDrawer />
    </>
  );
}
