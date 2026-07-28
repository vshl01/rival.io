'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/tickets/assignee-stack';
import { useOrgMembers } from '@/hooks/use-orgs';
import { useCreateTicket } from '@/hooks/use-tickets';
import { PRIORITY_META, PRIORITY_ORDER } from '@/lib/task-meta';
import type { Priority, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CreateTicketModalProps {
  /**
   * Which column opened the modal. `null` closes it.
   *
   * Kept even though creation always lands in Scoping — it drives the open state
   * and lets a caller show where the request came from.
   */
  status: TaskStatus | null;
  onClose: () => void;
  orgSlug: string;
  cycle: string;
  sprint: number;
}

/**
 * New ticket.
 *
 * Everything starts in SCOPING and is dragged onward from there. A ticket created
 * straight into "Done" is not a workflow, it is a record of something that already
 * happened — so the entry point is deliberately single.
 */
export function CreateTicketModal({
  status,
  onClose,
  orgSlug,
  cycle,
  sprint,
}: CreateTicketModalProps) {
  const open = status !== null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  // A Set so toggling is O(1) and order never matters.
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());

  // Members are only fetched once the modal is actually open.
  const { data: members } = useOrgMembers(open ? orgSlug : null);
  const create = useCreateTicket(orgSlug, cycle, sprint);

  // Clear between openings so a cancelled draft never reappears.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setDueDate('');
    setAssigneeIds(new Set());
  }, [open]);

  const trimmed = title.trim();

  /**
   * Fire and close. The card is on the board before the request lands, so waiting
   * on the round trip with a spinner would only make a working app feel slow —
   * and if the server refuses, the mutation removes the card and shows why.
   */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;

    const chosen = (members ?? []).filter((m) => assigneeIds.has(m.user.id)).map((m) => m.user);

    create.mutate({
      payload: {
        title: trimmed,
        description: description.trim() || null,
        // Hardcoded: every ticket enters the board in Scoping and is dragged
        // onward. Creating straight into Done records history rather than tracking
        // work, so the incoming state is not the caller's choice.
        status: 'SCOPING',
        priority,
        // A date input gives YYYY-MM-DD; widen it to an instant for the API.
        dueDate: dueDate ? new Date(`${dueDate}T17:00:00.000Z`).toISOString() : null,
        assigneeIds: [...assigneeIds],
      },
      optimistic: { assignees: chosen },
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New ticket"
      description="It starts in Scoping and gets its key automatically."
    >
      <form onSubmit={submit} className="space-y-4 px-6 py-5">
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

        <div>
          <Label htmlFor="ticket-desc" hint="optional">
            Description
          </Label>
          <Textarea
            id="ticket-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does done look like?"
            maxLength={5000}
            className="min-h-[72px]"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="ticket-priority">Priority</Label>
            <Select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ticket-due" hint="optional">
              Due
            </Label>
            <Input
              id="ticket-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label hint={assigneeIds.size ? `${assigneeIds.size} selected` : 'optional'}>
            Assignees
          </Label>
          {/* Several people can own one ticket, so this toggles rather than selects. */}
          <div className="flex flex-wrap gap-1.5">
            {members?.length ? (
              members.map((m) => {
                const on = assigneeIds.has(m.user.id);
                return (
                  <button
                    key={m.user.id}
                    type="button"
                    onClick={() =>
                      setAssigneeIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(m.user.id)) next.delete(m.user.id);
                        else next.add(m.user.id);
                        return next;
                      })
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors',
                      on
                        ? 'border-accent/40 bg-accent/10 text-ink'
                        : 'border-line bg-elevated text-ink-soft hover:text-ink',
                    )}
                  >
                    <Avatar person={m.user} size="sm" className="ring-transparent" />
                    {m.user.name}
                    {on && <Check className="h-3 w-3 text-accent" />}
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-ink-faint">Loading members…</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!trimmed}>
            Create ticket
          </Button>
        </div>
      </form>
    </Modal>
  );
}
