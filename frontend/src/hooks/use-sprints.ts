'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  ApiError,
  type CreateSprintPayload,
  type UpdateSprintPayload,
} from '@/lib/api';
import type { Cycle, Sprint } from '@/lib/types';
import { useAuth } from '@/store/auth';

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

/**
 * A sprint that is in its month block before the request finishes.
 *
 * `number` is 0 — the real one is issued per cycle by the server, and a guess
 * would render a link to a sprint that does not exist. The card checks for it and
 * stays unclickable until the row is real.
 */
export const PENDING_SPRINT_NUMBER = 0;

export function useCreateSprint(slug: string) {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const cyclesKey = sprintKeys.cycles(slug);

  return useMutation({
    mutationFn: ({ cycle, ...payload }: CreateSprintPayload & { cycle: string }) =>
      api.orgs.sprints.create(slug, cycle, payload),

    onMutate: async ({ cycle, name, startsAt, deadline }) => {
      await qc.cancelQueries({ queryKey: cyclesKey });
      const previous = qc.getQueryData<Cycle[]>(cyclesKey);

      const pending: Sprint = {
        id: `temp-${startsAt}-${name}`,
        number: PENDING_SPRINT_NUMBER,
        name,
        startsAt,
        deadline,
        createdAt: new Date().toISOString(),
        // Only an assigner can reach this, so the creator leads it.
        assigner: me ? { id: me.id, name: me.name, email: me.email } : { id: '', name: 'you', email: '' },
      };

      qc.setQueryData<Cycle[]>(cyclesKey, (cycles) =>
        cycles?.map((c) => (c.cycle === cycle ? { ...c, sprints: [...c.sprints, pending] } : c)),
      );

      return { previous };
    },

    onSuccess: (sprint) => {
      qc.invalidateQueries({ queryKey: sprintKeys.list(slug, sprint.cycle) });
      toast.success(`Sprint ${sprint.number} — ${sprint.name} created`);
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(cyclesKey, ctx.previous);
      showError(err, 'Could not create the sprint');
    },

    // The window carries each cycle's sprints, so it must refetch to pick up the
    // number the server issued.
    onSettled: () => qc.invalidateQueries({ queryKey: cyclesKey }),
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
  const cyclesKey = sprintKeys.cycles(slug);

  return useMutation({
    mutationFn: (num: number) => api.orgs.sprints.remove(slug, cycle, num),
    onMutate: async (num) => {
      await qc.cancelQueries({ queryKey: cyclesKey });
      const previous = qc.getQueryData<Cycle[]>(cyclesKey);
      // Gone from its month block at once — the caller usually navigates back to
      // the org straight after, and the sprint must not still be listed there.
      qc.setQueryData<Cycle[]>(cyclesKey, (cycles) =>
        cycles?.map((c) =>
          c.cycle === cycle ? { ...c, sprints: c.sprints.filter((s) => s.number !== num) } : c,
        ),
      );
      return { previous };
    },
    onSuccess: (_data, num) => {
      qc.removeQueries({ queryKey: sprintKeys.detail(slug, cycle, num) });
      toast.success('Sprint deleted');
    },
    onError: (err, _num, ctx) => {
      if (ctx?.previous) qc.setQueryData(cyclesKey, ctx.previous);
      showError(err, 'Could not delete the sprint — it is back');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: cyclesKey }),
  });
}
