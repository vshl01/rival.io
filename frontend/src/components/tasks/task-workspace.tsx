'use client';

import { useMemo, useState } from 'react';
import { useTasks } from '@/hooks/use-tasks';
import { useDebounce } from '@/hooks/use-debounce';
import type { TaskFilters } from '@/lib/types';
import { MomentumBar } from './momentum-bar';
import { TaskList } from './task-list';
import { TaskToolbar } from './task-toolbar';

const DEFAULT_FILTERS: TaskFilters = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 8,
};

/**
 * The full task workspace: momentum bar + toolbar + paginated list.
 * Reused by the dashboard and the admin console (which pins an `ownerId`).
 */
export function TaskWorkspace({ ownerId }: { ownerId?: string }) {
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);

  // Merge debounced search + owner scope into the query filters.
  const queryFilters = useMemo<TaskFilters>(
    () => ({
      ...filters,
      search: debouncedSearch.trim() || undefined,
      ownerId,
    }),
    [filters, debouncedSearch, ownerId],
  );

  const { data, isLoading, isError, isFetching, refetch } = useTasks(queryFilters);

  // Searching should always reset to the first page.
  const update = (patch: Partial<TaskFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const setSearchAndReset = (value: string) => {
    setSearch(value);
    setFilters((f) => ({ ...f, page: 1 }));
  };

  const hasActiveFilters = Boolean(filters.status || filters.priority || debouncedSearch.trim());
  const clearFilters = () => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-5">
      <MomentumBar ownerId={ownerId} />
      <TaskToolbar filters={filters} update={update} search={search} setSearch={setSearchAndReset} />
      <TaskList
        tasks={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isError={isError}
        isFetching={isFetching}
        refetch={refetch}
        filters={filters}
        update={update}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />
    </div>
  );
}
