'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  ApiError,
  type CreateSprintPayload,
  type UpdateSprintPayload,
} from '@/lib/api';

/* ── Query keys ─────────────────────────────────────────────── */
export const sprintKeys = {
  all: ['sprints'] as const,
  cycles: (slug: string) => [...sprintKeys.all, 'cycles', slug] as const,
  list: (slug: string, cycle: string) => [...sprintKeys.all, 'list', slug, cycle] as const,
  detail: (slug: string, cycle: string, num: number) =>
    [...sprintKeys.all, 'detail', slug, cycle, num] as const,
};

const showError = (err: unknown, fallback: string) =>
  toast.error(err instanceof ApiError ? err.message : fallback);

/* ── Queries ────────────────────────────────────────────────── */

/**
 * The rolling month window.
 *
 * Reading this is what creates the cycles server-side, so it is the entry point
 * for an organisation's workspace — nothing has to be set up first.
 */
export function useCycles(slug: string | null, months?: number) {
  return useQuery({
    queryKey: sprintKeys.cycles(slug ?? ''),
    queryFn: () => api.orgs.cycles(slug as string, months),
    enabled: !!slug,
  });
}

export function useSprint(slug: string | null, cycle: string | null, num: number | null) {
  return useQuery({
    queryKey: sprintKeys.detail(slug ?? '', cycle ?? '', num ?? 0),
    queryFn: () => api.orgs.sprints.get(slug as string, cycle as string, num as number),
    enabled: !!slug && !!cycle && num !== null,
    // 403/404 are final answers — not a member, or no such sprint.
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });
}

/* ── Mutations ──────────────────────────────────────────────── */
export function useCreateSprint(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cycle, ...payload }: CreateSprintPayload & { cycle: string }) =>
      api.orgs.sprints.create(slug, cycle, payload),
    onSuccess: (sprint) => {
      // The window carries each cycle's sprints, so it must refetch too.
      qc.invalidateQueries({ queryKey: sprintKeys.cycles(slug) });
      qc.invalidateQueries({ queryKey: sprintKeys.list(slug, sprint.cycle) });
      toast.success(`Sprint ${sprint.number} — ${sprint.name} created`);
    },
    onError: (err) => showError(err, 'Could not create the sprint'),
  });
}

export function useUpdateSprint(slug: string, cycle: string, num: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSprintPayload) =>
      api.orgs.sprints.update(slug, cycle, num, payload),
    onSuccess: (sprint) => {
      qc.setQueryData(sprintKeys.detail(slug, cycle, num), sprint);
      qc.invalidateQueries({ queryKey: sprintKeys.cycles(slug) });
      toast.success('Sprint updated');
    },
    onError: (err) => showError(err, 'Could not update the sprint'),
  });
}

export function useDeleteSprint(slug: string, cycle: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (num: number) => api.orgs.sprints.remove(slug, cycle, num),
    onSuccess: (_data, num) => {
      qc.removeQueries({ queryKey: sprintKeys.detail(slug, cycle, num) });
      qc.invalidateQueries({ queryKey: sprintKeys.cycles(slug) });
      toast.success('Sprint deleted');
    },
    onError: (err) => showError(err, 'Could not delete the sprint'),
  });
}
