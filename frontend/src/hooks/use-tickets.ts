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

export function useCreateTicket(slug: string, cycle: string, sprint: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload & { assigneeId?: string | null }) =>
      api.orgs.tickets.create(slug, cycle, sprint, payload),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ticketKeys.board(slug, cycle, sprint) });
      toast.success(`${ticket.key} created`);
    },
    onError: (err) => showError(err, 'Could not create the ticket'),
  });
}

/**
 * Update a ticket. Uses the shared single-ticket endpoint, so both the board and
 * any personal-task list must be invalidated.
 */
export function useUpdateTicket(slug: string, cycle: string, sprint: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<Task>) =>
      api.tasks.update(id, payload as Parameters<typeof api.tasks.update>[1]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.board(slug, cycle, sprint) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (err) => showError(err, 'Could not update the ticket'),
  });
}

/** Delete. Assigner-only server-side — the UI hides it for workers. */
export function useDeleteTicket(slug: string, cycle: string, sprint: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.board(slug, cycle, sprint) });
      toast.success('Ticket deleted');
    },
    onError: (err) => showError(err, 'Could not delete the ticket'),
  });
}
