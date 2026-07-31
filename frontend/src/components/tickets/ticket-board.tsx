'use client';

import { Plus, Ticket as TicketIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { useOrgMembers } from '@/hooks/use-orgs';
import { useCreateTicket, useDeleteTicket, useSprintTickets, useUpdateTicket } from '@/hooks/use-tickets';
import { formatDue } from '@/lib/format';
import type { Task, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

interface TicketBoardProps {
  orgSlug: string;
  cycle: string;
  sprint: number;
  /** Delete is assigner-only server-side; the control is hidden for workers. */
  canDelete: boolean;
}

/**
 * The tickets in one sprint, grouped by status.
 *
 * Creating and updating is open to every member — only deletion is restricted,
 * which is the single asymmetry in the permission model.
 */
export function TicketBoard({ orgSlug, cycle, sprint, canDelete }: TicketBoardProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: tickets, isLoading } = useSprintTickets(orgSlug, cycle, sprint);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {STATUSES.map((s) => (
          <Skeleton key={s} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <TicketIcon className="h-4 w-4 text-ink-faint" />
          Tickets
          {tickets?.length ? <span className="text-xs text-ink-faint">{tickets.length}</span> : null}
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New ticket
        </Button>
      </header>

      {!tickets?.length ? (
        <EmptyState
          icon={<TicketIcon className="h-6 w-6" />}
          title="No tickets yet"
          description="Anyone in the organisation can add the first one — assigners and workers alike."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New ticket
            </Button>
          }
          className="rounded-2xl border border-line bg-surface py-12"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {STATUSES.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              tickets={tickets.filter((t) => t.status === status)}
              orgSlug={orgSlug}
              cycle={cycle}
              sprint={sprint}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      <CreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgSlug={orgSlug}
        cycle={cycle}
        sprint={sprint}
      />
    </section>
  );
}

interface StatusColumnProps extends TicketBoardProps {
  status: TaskStatus;
  tickets: Task[];
}

function StatusColumn({ status, tickets, orgSlug, cycle, sprint, canDelete }: StatusColumnProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={status} />
        <span className="text-xs text-ink-faint">{tickets.length}</span>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">
          Nothing here
        </p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              orgSlug={orgSlug}
              cycle={cycle}
              sprint={sprint}
              canDelete={canDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  orgSlug,
  cycle,
  sprint,
  canDelete,
}: { ticket: Task } & Omit<TicketBoardProps, never>) {
  const update = useUpdateTicket(orgSlug, cycle, sprint);
  const remove = useDeleteTicket(orgSlug, cycle, sprint);
  const due = formatDue(ticket.dueDate);

  return (
    <li className="rounded-xl border border-line bg-canvas px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-ink-faint">{ticket.key}</span>
        {canDelete && (
          <button
            onClick={() => remove.mutate(ticket.id)}
            disabled={remove.isPending}
            aria-label={`Delete ${ticket.key}`}
            className="rounded p-0.5 text-ink-faint transition-colors hover:text-danger disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="mt-1 text-sm text-ink">{ticket.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={ticket.priority} />
        {due && (
          <span className={cn('text-[11px]', due.overdue ? 'text-danger' : 'text-ink-faint')}>
            {due.label}
          </span>
        )}
      </div>

      {ticket.assignee && (
        <p className="mt-2 truncate text-[11px] text-ink-faint">→ {ticket.assignee.name}</p>
      )}

      {/* Status is the one field worth changing inline — it is the whole board. */}
      <Select
        aria-label={`Status of ${ticket.key}`}
        value={ticket.status}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ id: ticket.id, status: e.target.value as TaskStatus })}
        className="mt-2 h-8 py-0 text-xs"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ').toLowerCase()}
          </option>
        ))}
      </Select>
    </li>
  );
}

function CreateTicketModal({
  open,
  onClose,
  orgSlug,
  cycle,
  sprint,
}: {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
  cycle: string;
  sprint: number;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const { data: members } = useOrgMembers(open ? orgSlug : null);
  const create = useCreateTicket(orgSlug, cycle, sprint);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(),
      priority,
      assigneeId: assigneeId || null,
    });
    setTitle('');
    setAssigneeId('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New ticket" description="It gets its key automatically.">
      <form onSubmit={submit} className="space-y-5 px-6 py-5">
        <div>
          <Label htmlFor="ticket-title">Title</Label>
          <Input
            id="ticket-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fix the dark-mode contrast on chips"
            autoFocus
            maxLength={200}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ticket-priority">Priority</Label>
            <Select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
            >
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                <option key={p} value={p}>
                  {p.toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ticket-assignee" hint="optional">
              Assign to
            </Label>
            <Select
              id="ticket-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Nobody</option>
              {members?.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
            Create ticket
          </Button>
        </div>
      </form>
    </Modal>
  );
}
