'use client';

import { Check, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { AssigneeStack, initials } from '@/components/tickets/assignee-stack';
import { Spinner } from '@/components/ui/feedback';
import { useOrgMembers } from '@/hooks/use-orgs';
import { useUpdateTask } from '@/hooks/use-tasks';
import type { Person } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AssigneeEditorProps {
  ticketId: string;
  orgSlug: string;
  assignees: Person[];
}

/**
 * Add or remove assignees at any time, from inside the ticket.
 *
 * Sends the FULL set on every change, because that is what the API promises —
 * `assigneeIds` replaces rather than merges. Toggling therefore means computing
 * the next set here, which keeps the server free of merge semantics it would
 * otherwise have to guess at.
 *
 * Reuses `useUpdateTask`, so the change is optimistic and rolls back on rejection
 * exactly like every other field.
 */
export function AssigneeEditor({ ticketId, orgSlug, assignees }: AssigneeEditorProps) {
  const [open, setOpen] = useState(false);
  const { data: members, isLoading } = useOrgMembers(open ? orgSlug : null);
  const update = useUpdateTask();

  const selected = new Set(assignees.map((a) => a.id));

  const toggle = (userId: string) => {
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);

    /*
      Preview the result so the chips and the card behind the drawer both change
      on click rather than after the round trip; a rejection rolls both back.

      People are resolved from the current assignees as well as the member list,
      because the cross on a tile works without ever opening the menu — and then
      `members` has not been fetched at all.
    */
    const known = new Map<string, Person>(assignees.map((p) => [p.id, p]));
    for (const m of members ?? []) known.set(m.user.id, m.user);
    const people = [...next]
      .map((id) => known.get(id))
      .filter((p): p is Person => !!p)
      // Matches the server, which returns assignees ordered by name.
      .sort((a, b) => a.name.localeCompare(b.name));

    update.mutate({
      id: ticketId,
      payload: { assigneeIds: [...next] },
      optimistic: { assignees: people },
    });
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-faint">Assignees</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-opacity hover:underline"
        >
          {update.isPending ? <Spinner className="h-3 w-3" /> : <UserPlus className="h-3.5 w-3.5" />}
          Change
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {assignees.length === 0 ? (
          <span className="text-sm text-ink-faint">Not assigned yet</span>
        ) : (
          assignees.map((person) => (
            <span
              key={person.id}
              className="group/tile inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated py-0.5 pl-0.5 pr-1 text-xs text-ink-soft transition-colors hover:border-danger/40"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-[8px] font-medium">
                {initials(person.name)}
              </span>
              {person.name}
              {/*
                Removing one person is the common case, and opening the menu to
                untick them is three interactions for it. The cross only appears
                on hover so the tile stays quiet at rest.
              */}
              <button
                onClick={() => toggle(person.id)}
                disabled={update.isPending}
                aria-label={`Unassign ${person.name}`}
                title={`Unassign ${person.name}`}
                className="rounded-full p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 disabled:opacity-40 group-hover/tile:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {open && (
        <>
          {/* Click-away layer, beneath the menu but above the drawer body. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-64 w-60 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lift">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner className="h-4 w-4" />
              </div>
            ) : !members?.length ? (
              <p className="px-3 py-3 text-xs text-ink-faint">No members to assign.</p>
            ) : (
              members.map((member) => {
                const isOn = selected.has(member.user.id);
                return (
                  <button
                    key={member.user.id}
                    onClick={() => toggle(member.user.id)}
                    disabled={update.isPending}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:opacity-50',
                      isOn ? 'text-ink' : 'text-ink-soft hover:bg-elevated hover:text-ink',
                    )}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-[9px] font-medium">
                      {initials(member.user.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{member.user.name}</span>
                    {isOn && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
