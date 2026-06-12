import type { ReactNode } from 'react';
import { PRIORITY_META, STATUS_META } from '@/lib/task-meta';
import type { Priority, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  const Icon = m.icon;
  return (
    <Chip className={m.chip}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Chip>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <Chip className={m.chip}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Chip>
  );
}
