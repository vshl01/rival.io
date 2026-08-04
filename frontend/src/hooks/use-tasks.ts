'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, type CreateTaskPayload, type UpdateTaskPayload } from '@/lib/api';
import { taskKeys, ticketKeys } from '@/lib/query-keys';
import type { Comment, PageMeta, Task, TaskFilters } from '@/lib/types';
import { useAuth } from '@/store/auth';

export { taskKeys };

type ListResult = { items: Task[]; meta: PageMeta };

/* ── Queries ────────────────────────────────────────────────── */
export function useTasks(filters: Partial<TaskFilters>) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => api.tasks.list(filters),
    placeholderData: keepPreviousData, // smooth pagination / filter changes
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => api.tasks.get(id as string),
    enabled: !!id,
  });
}

export function useTaskActivity(id: string | null) {
  return useQuery({
    queryKey: taskKeys.activity(id ?? ''),
    queryFn: () => api.tasks.activity(id as string),
    enabled: !!id,
  });
}

/** Lightweight per-status counts for the dashboard "momentum" bar. */
export function useTaskStats(ownerId?: string) {
  return useQuery({
    queryKey: [...taskKeys.stats(), ownerId ?? null],
    queryFn: async () => {
      const base = { pageSize: 1, page: 1, ownerId } as Partial<TaskFilters>;
      const [all, todo, inProgress, done] = await Promise.all([
        api.tasks.list(base),
        api.tasks.list({ ...base, status: 'TODO' }),
        api.tasks.list({ ...base, status: 'IN_PROGRESS' }),
        api.tasks.list({ ...base, status: 'DONE' }),
      ]);
      return {
        total: all.meta.total,
        todo: todo.meta.total,
        inProgress: inProgress.meta.total,
        done: done.meta.total,
      };
    },
  });
}

/* ── Optimistic helpers ─────────────────────────────────────── */
function patchListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (items: Task[]) => Task[],
) {
  queryClient.setQueriesData<ListResult>({ queryKey: taskKeys.lists() }, (old) =>
    old ? { ...old, items: updater(old.items) } : old,
  );
}

/**
 * Apply the same change to every cached sprint board.
 *
 * `/api/tasks/:id` serves both kinds, so these hooks are what the ticket drawer
 * uses too — and a change made in the drawer has to land on the board behind it
 * or the card silently disagrees with the panel that just edited it. Boards are
 * plain `Task[]`, keyed by org/cycle/sprint, and the drawer does not know which
 * board it was opened from, so every one is patched.
 */
function patchBoardCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (items: Task[]) => Task[],
) {
  queryClient.setQueriesData<Task[]>({ queryKey: ticketKeys.all }, (old) =>
    old ? updater(old) : old,
  );
}

function reportError(err: unknown, fallback: string) {
  const message = err instanceof ApiError ? err.message : fallback;
  toast.error(message);
}

/* ── Mutations ──────────────────────────────────────────────── */

/**
 * A row that exists only in the cache while its request is in flight.
 *
 * Optimistic inserts need an id before the server has issued one, so they get a
 * `temp-` prefix. Anything that would send that id back to the API — opening,
 * editing, deleting — has to wait for the real row, and this is how the UI knows.
 */
export const isPendingTask = (id: string) => id.startsWith('temp-');
export const isPendingComment = isPendingTask;

/**
 * Create a task that is in the list before the request finishes.
 *
 * Inserted at the top of whatever page is on screen — the sort is the server's
 * to decide, and `onSettled` refetches to put it where it truly belongs. The
 * point is that the list never looks empty for a round trip.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);

  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => api.tasks.create(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previousLists = queryClient.getQueriesData<ListResult>({ queryKey: taskKeys.lists() });

      const now = new Date().toISOString();
      const pending: Task = {
        id: `temp-${now}`,
        title: payload.title,
        description: payload.description ?? null,
        status: payload.status ?? 'TODO',
        priority: payload.priority ?? 'MEDIUM',
        dueDate: payload.dueDate ?? null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ownerId: me?.id ?? '',
        key: null,
        _count: { attachments: 0, activities: 0, comments: 0 },
      };
      patchListCaches(queryClient, (items) => [pending, ...items]);

      return { previousLists, pendingId: pending.id };
    },
    onSuccess: (task, _payload, ctx) => {
      toast.success('Task created');
      queryClient.setQueryData(taskKeys.detail(task.id), task);
      // Swap the placeholder for the real row so the card does not blink.
      patchListCaches(queryClient, (items) =>
        items.map((t) => (t.id === ctx?.pendingId ? task : t)),
      );
    },
    onError: (err, _payload, ctx) => {
      ctx?.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      reportError(err, 'Could not create task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
    },
  });
}

interface UpdateTaskVars {
  id: string;
  payload: UpdateTaskPayload;
  /**
   * Cache-shaped preview for fields the payload cannot describe.
   *
   * Most of `UpdateTaskPayload` matches the model one-for-one, so spreading it is
   * a correct preview. Relations do not: the API takes `assigneeIds`, the model
   * holds `assignees: Person[]`. The caller already has the people it just
   * picked, so it passes them here instead of the UI waiting on a round trip.
   */
  optimistic?: Partial<Task>;
}

/**
 * Optimistic update — the card changes instantly and rolls back on failure.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: UpdateTaskVars) => api.tasks.update(id, payload),
    onMutate: async ({ id, payload, optimistic }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: ticketKeys.all });

      const previousLists = queryClient.getQueriesData<ListResult>({ queryKey: taskKeys.lists() });
      const previousBoards = queryClient.getQueriesData<Task[]>({ queryKey: ticketKeys.all });
      const previousDetail = queryClient.getQueryData<Task>(taskKeys.detail(id));

      const apply = (t: Task): Task => {
        // `assigneeIds` is request-shaped, not model-shaped: writing it into the
        // cache would leave a field the UI never reads and the server never
        // returns. `optimistic` carries the model-shaped version.
        const { assigneeIds: _relation, ...scalars } = payload;
        const next: Task = { ...t, ...scalars, ...optimistic } as Task;
        if (payload.status && payload.status !== t.status) {
          next.completedAt = payload.status === 'DONE' ? new Date().toISOString() : null;
        }
        return next;
      };

      const patch = (items: Task[]) => items.map((t) => (t.id === id ? apply(t) : t));
      patchListCaches(queryClient, patch);
      patchBoardCaches(queryClient, patch);
      if (previousDetail) queryClient.setQueryData(taskKeys.detail(id), apply(previousDetail));

      return { previousLists, previousBoards, previousDetail, id };
    },
    onError: (err, _vars, ctx) => {
      // Roll back to the snapshots.
      ctx?.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      ctx?.previousBoards.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (ctx?.previousDetail) queryClient.setQueryData(taskKeys.detail(ctx.id), ctx.previousDetail);
      reportError(err, 'Update failed — rolled back');
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      // Every update writes an audit entry, so an open timeline is now stale.
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(id) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      await queryClient.cancelQueries({ queryKey: ticketKeys.all });
      const previousLists = queryClient.getQueriesData<ListResult>({ queryKey: taskKeys.lists() });
      const previousBoards = queryClient.getQueriesData<Task[]>({ queryKey: ticketKeys.all });
      const drop = (items: Task[]) => items.filter((t) => t.id !== id);
      patchListCaches(queryClient, drop);
      patchBoardCaches(queryClient, drop);
      return { previousLists, previousBoards };
    },
    onError: (err, _id, ctx) => {
      ctx?.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      ctx?.previousBoards.forEach(([key, data]) => queryClient.setQueryData(key, data));
      reportError(err, 'Delete failed — rolled back');
    },
    onSuccess: () => toast.success('Task deleted'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
}

/* ── Comments ───────────────────────────────────────────────── */
export function useTaskComments(id: string | null) {
  return useQuery({
    queryKey: taskKeys.comments(id ?? ''),
    queryFn: () => api.tasks.comments(id as string),
    enabled: !!id,
  });
}

/**
 * Post a comment that appears instantly.
 *
 * The temporary comment carries a `temp-` id so the thread can render it dimmed
 * while it is in flight, and it is swapped for the server's row on success — not
 * merely invalidated, which would make the comment disappear and reappear.
 */
export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const key = taskKeys.comments(taskId);

  return useMutation({
    mutationFn: (body: string) => api.tasks.addComment(taskId, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);

      const now = new Date().toISOString();
      const pending: Comment = {
        id: `temp-${now}`,
        body,
        createdAt: now,
        updatedAt: now,
        author: me ? { id: me.id, name: me.name, email: me.email, role: me.role } : null,
      };
      queryClient.setQueryData<Comment[]>(key, (old) => [...(old ?? []), pending]);

      return { previous, pendingId: pending.id };
    },
    onSuccess: (saved, _body, ctx) => {
      queryClient.setQueryData<Comment[]>(key, (old) =>
        (old ?? []).map((c) => (c.id === ctx?.pendingId ? saved : c)),
      );
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(taskId) });
    },
    onError: (err, _body, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      reportError(err, 'Could not post comment');
    },
  });
}

export function useRemoveComment(taskId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.comments(taskId);

  return useMutation({
    mutationFn: (commentId: string) => api.tasks.removeComment(taskId, commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (old) => (old ?? []).filter((c) => c.id !== commentId));
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      reportError(err, 'Could not delete comment — it is back');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useAddAttachment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.tasks.addAttachment(taskId, file),
    onSuccess: () => {
      toast.success('Attachment added');
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (err) => reportError(err, 'Upload failed'),
  });
}

export function useRemoveAttachment(taskId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.detail(taskId);

  return useMutation({
    mutationFn: (attachmentId: string) => api.tasks.removeAttachment(taskId, attachmentId),
    onMutate: async (attachmentId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task>(key);
      queryClient.setQueryData<Task>(key, (old) =>
        old
          ? {
              ...old,
              attachments: old.attachments?.filter((a) => a.id !== attachmentId),
              _count: old._count
                ? { ...old._count, attachments: Math.max(0, old._count.attachments - 1) }
                : old._count,
            }
          : old,
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      reportError(err, 'Could not remove attachment — it is back');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
}
