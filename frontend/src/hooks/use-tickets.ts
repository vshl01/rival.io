'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, type CreateTaskPayload, type UpdateTaskPayload } from '@/lib/api';
import { taskKeys, ticketKeys } from '@/lib/query-keys';
import type { Task } from '@/lib/types';
import { useAuth } from '@/store/auth';

/**
 * Sprint tickets.
 *
 * Separate from `use-tasks` because the two are governed differently — a personal
 * task is scoped to its creator, a ticket to org membership — but they share the
 * single-ticket endpoints (`/api/tasks/:id`), so every mutation invalidates both
 * key spaces.
 *
 * All mutations are optimistic: the board updates on click and rolls back if the
 * server rejects it. Waiting on a round-trip to Neon for a status change makes the
 * board feel broken even when it is working.
 */
export { ticketKeys };

const showError = (err: unknown, fallback: string) =>
  toast.error(err instanceof ApiError ? err.message : fallback);

export function useSprintTickets(
  slug: string | null,
  cycle: string | null,
  sprint: number | null,
) {
  return useQuery({
    queryKey: ticketKeys.board(slug ?? '', cycle ?? '', sprint ?? 0),
    queryFn: () => api.orgs.tickets.list(slug as string, cycle as string, sprint as number),
    enabled: !!slug && !!cycle && sprint !== null,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });
}

/** Marks a card that exists only in the cache, waiting on the server. */
export const isPendingTicket = (id: string) => id.startsWith('temp-');

interface CreateTicketVars {
  payload: CreateTaskPayload;
  /**
   * Model-shaped preview of what the payload cannot express — the chosen people
   * behind `assigneeIds`. The modal already has them, so the card can show real
   * avatars instead of appearing empty and then filling in.
   */
  optimistic?: Partial<Task>;
}

/**
 * Create a ticket that is on the board before the request finishes.
 *
 * The placeholder carries a `temp-` id and no key — the key is issued by the
 * server, and inventing one would put a wrong `ACME-n` on screen for a second.
 * On success the placeholder is swapped for the real row rather than invalidated,
 * so the card never blinks; on failure it is removed and the error is shown.
 */
export function useCreateTicket(slug: string, cycle: string, sprint: number) {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const boardKey = ticketKeys.board(slug, cycle, sprint);

  return useMutation({
    mutationFn: ({ payload }: CreateTicketVars) =>
      api.orgs.tickets.create(slug, cycle, sprint, payload),

    onMutate: async ({ payload, optimistic }) => {
      await qc.cancelQueries({ queryKey: boardKey });
      const previous = qc.getQueryData<Task[]>(boardKey);

      const now = new Date().toISOString();
      const pending: Task = {
        id: `temp-${now}`,
        title: payload.title,
        description: payload.description ?? null,
        status: payload.status ?? 'SCOPING',
        priority: payload.priority ?? 'MEDIUM',
        dueDate: payload.dueDate ?? null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ownerId: me?.id ?? '',
        key: null,
        assignees: [],
        _count: { attachments: 0, activities: 0, comments: 0 },
        ...optimistic,
      };
      qc.setQueryData<Task[]>(boardKey, (tickets) => [...(tickets ?? []), pending]);

      return { previous, pendingId: pending.id };
    },

    onSuccess: (ticket, _vars, ctx) => {
      qc.setQueryData<Task[]>(boardKey, (tickets) =>
        (tickets ?? []).map((t) => (t.id === ctx?.pendingId ? ticket : t)),
      );
      toast.success(`${ticket.key} created`);
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(boardKey, ctx.previous);
      showError(err, 'Could not create the ticket');
    },

    onSettled: () => qc.invalidateQueries({ queryKey: boardKey }),
  });
}

/**
 * Update a ticket, applied to the board cache immediately.
 *
 * `onMutate` snapshots the board, patches it, and `onError` restores the snapshot
 * — so a rejected change (a non-member, a stale ticket) visibly reverts instead of
 * leaving the UI lying about server state.
 */
export function useUpdateTicket(slug: string, cycle: string, sprint: number) {
  const qc = useQueryClient();
  const boardKey = ticketKeys.board(slug, cycle, sprint);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTaskPayload }) =>
      api.tasks.update(id, payload),

    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: boardKey });
      const previous = qc.getQueryData<Task[]>(boardKey);

      // `assigneeIds` is request-shaped; the board reads `assignees`. Assignee
      // edits go through the drawer, which previews the resolved people itself.
      const { assigneeIds: _relation, ...scalars } = payload;

      qc.setQueryData<Task[]>(boardKey, (tickets) =>
        tickets?.map((ticket) =>
          ticket.id === id
            ? {
                ...ticket,
                ...scalars,
                // Mirror the server's rule so the card does not flicker when the
                // real response arrives.
                completedAt:
                  payload.status && payload.status !== ticket.status
                    ? payload.status === 'DONE'
                      ? new Date().toISOString()
                      : null
                    : ticket.completedAt,
              }
            : ticket,
        ),
      );

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(boardKey, ctx.previous);
      showError(err, 'Update failed — rolled back');
    },

    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: boardKey });
      // The drawer and any personal-task list read the same ticket.
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      // A move is audited, so the drawer's timeline has a new entry to show.
      qc.invalidateQueries({ queryKey: taskKeys.activity(id) });
    },
  });
}

/** Delete, removed from the board immediately. Assigner-only server-side. */
export function useDeleteTicket(slug: string, cycle: string, sprint: number) {
  const qc = useQueryClient();
  const boardKey = ticketKeys.board(slug, cycle, sprint);

  return useMutation({
    mutationFn: (id: string) => api.tasks.remove(id),

    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: boardKey });
      const previous = qc.getQueryData<Task[]>(boardKey);
      qc.setQueryData<Task[]>(boardKey, (tickets) => tickets?.filter((t) => t.id !== id));
      return { previous };
    },

    onError: (err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(boardKey, ctx.previous);
      showError(err, 'Delete failed — the ticket is back');
    },

    onSuccess: () => toast.success('Ticket deleted'),
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey }),
  });
}
