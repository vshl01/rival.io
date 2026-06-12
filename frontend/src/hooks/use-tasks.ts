'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, type CreateTaskPayload, type UpdateTaskPayload } from '@/lib/api';
import type { PageMeta, Task, TaskFilters } from '@/lib/types';

/* ── Query keys ─────────────────────────────────────────────── */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: Partial<TaskFilters>) => [...taskKeys.lists(), filters] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  activity: (id: string) => [...taskKeys.all, 'activity', id] as const,
  comments: (id: string) => [...taskKeys.all, 'comments', id] as const,
  stats: () => [...taskKeys.all, 'stats'] as const,
};

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

function reportError(err: unknown, fallback: string) {
  const message = err instanceof ApiError ? err.message : fallback;
  toast.error(message);
}

/* ── Mutations ──────────────────────────────────────────────── */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => api.tasks.create(payload),
    onSuccess: (task) => {
      toast.success('Task created');
      queryClient.setQueryData(taskKeys.detail(task.id), task);
    },
    onError: (err) => reportError(err, 'Could not create task'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
    },
  });
}

/**
 * Optimistic update — the card changes instantly and rolls back on failure.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTaskPayload }) =>
      api.tasks.update(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) });

      const previousLists = queryClient.getQueriesData<ListResult>({ queryKey: taskKeys.lists() });
      const previousDetail = queryClient.getQueryData<Task>(taskKeys.detail(id));

      const apply = (t: Task): Task => {
        const next: Task = { ...t, ...payload } as Task;
        if (payload.status && payload.status !== t.status) {
          next.completedAt = payload.status === 'DONE' ? new Date().toISOString() : null;
        }
        return next;
      };

      patchListCaches(queryClient, (items) => items.map((t) => (t.id === id ? apply(t) : t)));
      if (previousDetail) queryClient.setQueryData(taskKeys.detail(id), apply(previousDetail));

      return { previousLists, previousDetail, id };
    },
    onError: (err, _vars, ctx) => {
      // Roll back to the snapshots.
      ctx?.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (ctx?.previousDetail) queryClient.setQueryData(taskKeys.detail(ctx.id), ctx.previousDetail);
      reportError(err, 'Update failed — rolled back');
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previousLists = queryClient.getQueriesData<ListResult>({ queryKey: taskKeys.lists() });
      patchListCaches(queryClient, (items) => items.filter((t) => t.id !== id));
      return { previousLists };
    },
    onError: (err, _id, ctx) => {
      ctx?.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      reportError(err, 'Delete failed — rolled back');
    },
    onSuccess: () => toast.success('Task deleted'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
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

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.tasks.addComment(taskId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (err) => reportError(err, 'Could not post comment'),
  });
}

export function useRemoveComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.tasks.removeComment(taskId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (err) => reportError(err, 'Could not delete comment'),
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
  return useMutation({
    mutationFn: (attachmentId: string) => api.tasks.removeAttachment(taskId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (err) => reportError(err, 'Could not remove attachment'),
  });
}
