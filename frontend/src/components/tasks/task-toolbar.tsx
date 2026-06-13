'use client';

import { ArrowDownNarrowWide, ArrowUpNarrowWide, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { PRIORITY_META, PRIORITY_ORDER, SORT_OPTIONS, STATUS_META, STATUS_ORDER } from '@/lib/task-meta';
import type { Priority, SortField, SortOrder, TaskFilters, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';

interface ToolbarProps {
  filters: TaskFilters;
  update: (patch: Partial<TaskFilters>) => void;
  search: string;
  setSearch: (value: string) => void;
}

export function TaskToolbar({ filters, update, search, setSearch }: ToolbarProps) {
  const openTaskForm = useUi((s) => s.openTaskForm);

  const statusTabs: { value: TaskStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'All' },
    ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label })),
  ];

  return (
    <div className="space-y-3">
      {/* Row 1 — search + new */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title…"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-faint hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button size="lg" onClick={() => openTaskForm()} className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New task</span>
        </Button>
      </div>

      {/* Row 2 — status tabs + priority + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {statusTabs.map((t) => {
            const active = (filters.status ?? 'ALL') === t.value;
            return (
              <button
                key={t.value}
                onClick={() => update({ status: t.value === 'ALL' ? undefined : (t.value as TaskStatus), page: 1 })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-elevated font-medium text-ink shadow-soft' : 'text-ink-soft hover:text-ink',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select
            aria-label="Filter by priority"
            value={filters.priority ?? ''}
            onChange={(e) => update({ priority: (e.target.value || undefined) as Priority | undefined, page: 1 })}
            className="h-10 w-auto py-0"
          >
            <option value="">All priorities</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p].label}</option>
            ))}
          </Select>

          <Select
            aria-label="Sort by"
            value={filters.sortBy}
            onChange={(e) => update({ sortBy: e.target.value as SortField })}
            className="h-10 w-auto py-0"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>Sort: {o.label}</option>
            ))}
          </Select>

          <button
            onClick={() => update({ sortOrder: (filters.sortOrder === 'asc' ? 'desc' : 'asc') as SortOrder })}
            aria-label="Toggle sort direction"
            title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-ink"
          >
            {filters.sortOrder === 'asc' ? (
              <ArrowUpNarrowWide className="h-4 w-4" />
            ) : (
              <ArrowDownNarrowWide className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
