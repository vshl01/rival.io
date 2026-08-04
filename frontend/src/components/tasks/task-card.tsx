'use client';

import { motion } from 'framer-motion';
import { Activity as ActivityIcon, Check, MessageSquare, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { isPendingTask, useDeleteTask, useUpdateTask } from '@/hooks/use-tasks';
import { formatDue } from '@/lib/format';
import { popIn } from '@/lib/motion';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';

export const TaskCard = forwardRef<HTMLDivElement, { task: Task }>(function TaskCard({ task }, ref) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const openTaskForm = useUi((s) => s.openTaskForm);
  const openDetail = useUi((s) => s.openDetail);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const done = task.status === 'DONE';
  // Optimistically created and still saving: there is no server row to open,
  // edit or delete yet, so those controls wait for the real id.
  const pending = isPendingTask(task.id);
  const due = formatDue(task.dueDate);
  const attachments = task._count?.attachments ?? 0;
  const activities = task._count?.activities ?? 0;
  const comments = task._count?.comments ?? 0;

  const toggleComplete = () => {
    updateTask.mutate({ id: task.id, payload: { status: done ? 'TODO' : 'DONE' } });
  };

  return (
    <motion.div
      ref={ref}
      layout
      variants={popIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        'group relative flex gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-faint/40 hover:shadow-soft sm:p-5',
        done && 'opacity-70',
        pending && 'animate-pulse border-dashed',
      )}
    >
      {/* Complete toggle */}
      <button
        onClick={toggleComplete}
        disabled={pending}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          done
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-line text-transparent hover:border-accent hover:text-accent/40',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>

      {/* Body — clicking opens the detail drawer */}
      <button
        onClick={() => openDetail(task.id)}
        disabled={pending}
        className="min-w-0 flex-1 text-left"
      >
        <p className={cn('truncate font-medium text-ink', done && 'text-ink-soft line-through')}>
          {task.title}
        </p>
        {task.description && (
          <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{task.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
          {due && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                due.overdue && !done
                  ? 'border-danger/30 bg-danger/10 text-danger'
                  : due.soon && !done
                    ? 'border-high/30 bg-high/10 text-high'
                    : 'border-line text-ink-soft',
              )}
            >
              {due.overdue && !done ? 'Overdue · ' : ''}
              {due.label}
            </span>
          )}
          {attachments > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
              <Paperclip className="h-3 w-3" /> {attachments}
            </span>
          )}
          {comments > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
              <MessageSquare className="h-3 w-3" /> {comments}
            </span>
          )}
          {activities > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
              <ActivityIcon className="h-3 w-3" /> {activities}
            </span>
          )}
        </div>
      </button>

      {/* Hover actions */}
      <div
        className={cn(
          'absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100',
          pending && 'hidden',
        )}
      >
        <button
          onClick={() => openTaskForm(task.id)}
          aria-label="Edit task"
          className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-elevated hover:text-ink"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          aria-label="Delete task"
          className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete task?" description="This can’t be undone.">
        <div className="px-6 py-6">
          <p className="text-sm text-ink-soft">
            You’re about to delete <span className="font-medium text-ink">“{task.title}”</span>.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteTask.mutate(task.id);
                setConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
});
