'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Inbox, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import type { PageMeta, Task, TaskFilters } from '@/lib/types';
import { useUi } from '@/store/ui';
import { TaskCard } from './task-card';

interface TaskListProps {
  tasks: Task[] | undefined;
  meta: PageMeta | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  filters: TaskFilters;
  update: (patch: Partial<TaskFilters>) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function TaskList({
  tasks,
  meta,
  isLoading,
  isError,
  isFetching,
  refetch,
  filters,
  update,
  hasActiveFilters,
  onClearFilters,
}: TaskListProps) {
  const openTaskForm = useUi((s) => s.openTaskForm);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card">
        <ErrorState message="We couldn’t load your tasks. Check your connection and try again." onRetry={refetch} />
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="card">
        {hasActiveFilters ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No matching tasks"
            description="Nothing fits these filters. Try widening your search."
            action={<Button variant="secondary" onClick={onClearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="A clean slate"
            description="You have no tasks yet. Create your first one and start building momentum."
            action={<Button onClick={() => openTaskForm()}>Create a task</Button>}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <motion.div layout className="space-y-3" style={{ opacity: isFetching ? 0.7 : 1 }}>
        <AnimatePresence initial={false} mode="popLayout">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </AnimatePresence>
      </motion.div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-ink-faint">
            Page <span className="font-medium text-ink-soft">{meta.page}</span> of {meta.totalPages}
            <span className="hidden sm:inline"> · {meta.total} tasks</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!meta.hasPrevPage}
              onClick={() => update({ page: filters.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => update({ page: filters.page + 1 })}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
