'use client';

import { MessageSquare, Paperclip, Trash2 } from 'lucide-react';
import { AssigneeStack } from '@/components/tickets/assignee-stack';
import { PRIORITY_META, STATUS_META } from '@/lib/task-meta';
import { formatDue } from '@/lib/format';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';

interface TicketCardProps {
  ticket: Task;
  /** Delete is assigner-only server-side, so the control is hidden otherwise. */
  canDelete: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
  /**
   * Optimistically created and still in flight. It has no key or id yet, so it
   * cannot be opened, dragged or deleted — but it is on the board immediately.
   */
  pending?: boolean;
}

/**
 * One ticket on the board — deliberately dense.
 *
 * Clicking it opens the shared detail drawer, the same component personal tasks
 * use, which is why tickets get comments, the activity timeline and attachments
 * without a second implementation.
 */
export function TicketCard({ ticket, canDelete, onDelete, deleting, pending }: TicketCardProps) {
  const openDetail = useUi((s) => s.openDetail);
  const priority = PRIORITY_META[ticket.priority];
  const status = STATUS_META[ticket.status];
  const due = formatDue(ticket.dueDate);
  const retired = ticket.status === 'REMOVED';

  const open = () => {
    if (!pending) openDetail(ticket.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-lg border border-line bg-surface',
        'py-2 pl-2.5 pr-2 transition-all',
        'hover:border-ink-faint/50 hover:shadow-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50',
        deleting && 'pointer-events-none opacity-40',
        pending && 'animate-pulse cursor-default border-dashed',
        retired && 'opacity-60',
      )}
    >
      {/* Status as a colour edge — the board's shape reads without any text. */}
      <span className={cn('absolute inset-y-0 left-0 w-0.5', status.accent)} aria-hidden />

      {/* Key and delete share one line so the title gets the full width. */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] leading-none tracking-tight text-ink-faint">
          {/* The key is issued by the server, so a pending card has none to show. */}
          {ticket.key ?? 'saving…'}
        </span>
        <span
          className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full', priority.text.replace('text-', 'bg-'))}
          title={`${priority.label} priority`}
          aria-label={`${priority.label} priority`}
        />
        {canDelete && !pending && (
          <button
            onClick={(e) => {
              // Without this the card's own click would open the drawer too.
              e.stopPropagation();
              onDelete(ticket.id);
            }}
            aria-label={`Delete ${ticket.key}`}
            className="-mr-0.5 rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <p
        className={cn(
          'mt-1 line-clamp-2 text-[13px] leading-snug text-ink',
          retired && 'line-through',
        )}
      >
        {ticket.title}
      </p>

      {/* Footer only renders when there is something to say. */}
      {(ticket.assignees?.length || due || ticket._count?.comments || ticket._count?.attachments) && (
        <div className="mt-1.5 flex items-center gap-2">
          <AssigneeStack assignees={ticket.assignees ?? []} className="shrink-0" />

          {due && (
            <span
              className={cn(
                'text-[10px] leading-none',
                due.overdue ? 'font-medium text-danger' : due.soon ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {due.overdue ? 'overdue' : due.label}
            </span>
          )}

          <span className="ml-auto flex items-center gap-1.5 text-[10px] leading-none text-ink-faint">
            {!!ticket._count?.comments && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-2.5 w-2.5" />
                {ticket._count.comments}
              </span>
            )}
            {!!ticket._count?.attachments && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="h-2.5 w-2.5" />
                {ticket._count.attachments}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
