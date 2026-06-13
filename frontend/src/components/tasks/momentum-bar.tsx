'use client';

import { motion } from 'framer-motion';
import { useTaskStats } from '@/hooks/use-tasks';
import { Skeleton } from '@/components/ui/feedback';

export function MomentumBar({ ownerId }: { ownerId?: string }) {
  const { data, isLoading } = useTaskStats(ownerId);

  if (isLoading || !data) {
    return <Skeleton className="h-[92px] w-full rounded-2xl" />;
  }

  const { total, todo, inProgress, done } = data;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    { label: 'To do', value: todo, dot: 'bg-ink-faint' },
    { label: 'In progress', value: inProgress, dot: 'bg-medium' },
    { label: 'Done', value: done, dot: 'bg-accent' },
  ];

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow mb-1">Momentum</p>
          <p className="font-display text-3xl text-ink">
            {done}
            <span className="text-ink-faint"> / {total} done</span>
          </p>
        </div>
        <div className="flex items-center gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <span className="text-sm text-ink-soft">{s.label}</span>
              <span className="font-mono text-sm font-medium text-ink">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress rail */}
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-elevated">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p className="mt-2 text-right font-mono text-xs text-ink-faint">{pct}% complete</p>
    </div>
  );
}
