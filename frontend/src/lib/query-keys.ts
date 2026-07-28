/**
 * Every React Query key in one place.
 *
 * Personal tasks and sprint tickets are read through different endpoints but are
 * the same row underneath (`/api/tasks/:id` serves both), so a single mutation
 * often has to touch caches in both namespaces. Keeping the factories together
 * means `use-tasks` and `use-tickets` can each reach the other's keys without
 * importing one another — an import cycle whose failure mode is an `undefined`
 * key at module-init time, which is nearly impossible to debug from the symptom.
 */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...taskKeys.lists(), filters] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  activity: (id: string) => [...taskKeys.all, 'activity', id] as const,
  comments: (id: string) => [...taskKeys.all, 'comments', id] as const,
  stats: () => [...taskKeys.all, 'stats'] as const,
};

export const ticketKeys = {
  all: ['tickets'] as const,
  board: (slug: string, cycle: string, sprint: number) =>
    [...ticketKeys.all, 'board', slug, cycle, sprint] as const,
};
