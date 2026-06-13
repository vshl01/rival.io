import { formatRelative } from '@/lib/format';
import type { Activity } from '@/lib/types';

const ACTION_LABEL: Record<string, string> = {
  'task.created': 'created this task',
  'task.updated': 'updated the task',
  'task.completed': 'marked it done',
  'attachment.added': 'added an attachment',
  'attachment.removed': 'removed an attachment',
};

function describe(activity: Activity): string {
  const base = ACTION_LABEL[activity.action] ?? activity.action;
  const changes = (activity.metadata as { changes?: Record<string, unknown> } | null)?.changes;
  if (activity.action === 'task.updated' && changes) {
    const fields = Object.keys(changes);
    if (fields.length) return `changed ${fields.join(', ')}`;
  }
  return base;
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (!activities.length) {
    return <p className="mt-2 text-sm text-ink-faint">No activity yet.</p>;
  }
  return (
    <ol className="mt-3 space-y-0">
      {activities.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
          {/* Timeline rail */}
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
            {i < activities.length - 1 && <span className="w-px flex-1 bg-line" />}
          </div>
          <div className="-mt-0.5 pb-1">
            <p className="text-sm text-ink">
              <span className="font-medium">{a.actor?.name ?? 'Someone'}</span>{' '}
              <span className="text-ink-soft">{describe(a)}</span>
            </p>
            <p className="text-xs text-ink-faint">{formatRelative(a.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
