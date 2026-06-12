'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { CheckCircle2, CircleDashed, CircleDot, Flame, Search } from 'lucide-react';
import type { PointerEvent } from 'react';

const MOCK = [
  { title: 'Ship the onboarding flow', status: 'IN_PROGRESS', tag: 'URGENT', tagClass: 'text-urgent bg-urgent/10 border-urgent/30', Icon: Flame, due: 'Today' },
  { title: 'Design the weekly review ritual', status: 'TODO', tag: 'HIGH', tagClass: 'text-high bg-high/10 border-high/30', Icon: Flame, due: 'Thu' },
  { title: 'Add optimistic UI to toggles', status: 'IN_PROGRESS', tag: 'URGENT', tagClass: 'text-urgent bg-urgent/10 border-urgent/30', Icon: Flame, due: 'Tomorrow' },
  { title: 'Audit dashboard accessibility', status: 'TODO', tag: 'HIGH', tagClass: 'text-high bg-high/10 border-high/30', Icon: Flame, due: 'Fri' },
  { title: 'Archive last quarter’s OKRs', status: 'DONE', tag: 'LOW', tagClass: 'text-low bg-low/10 border-low/30', Icon: Flame, due: 'Done' },
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'DONE') return <CheckCircle2 className="h-5 w-5 text-accent" />;
  if (status === 'IN_PROGRESS') return <CircleDot className="h-5 w-5 text-medium" />;
  return <CircleDashed className="h-5 w-5 text-ink-faint" />;
};

export function HeroBoard() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 150, damping: 20 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="overflow-hidden rounded-3xl border border-line bg-surface shadow-lift"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-urgent/60" />
            <span className="h-3 w-3 rounded-full bg-medium/60" />
            <span className="h-3 w-3 rounded-full bg-accent/60" />
          </div>
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink-faint">
            <Search className="h-3.5 w-3.5" />
            Search tasks…
          </div>
          <div className="hidden gap-1.5 sm:flex">
            {['All', 'To do', 'In progress'].map((t, i) => (
              <span
                key={t}
                className={`rounded-md px-2.5 py-1 text-xs ${i === 0 ? 'bg-accent text-accent-ink' : 'text-ink-soft'}`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Task rows */}
        <div className="divide-y divide-line">
          {MOCK.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
            >
              <StatusIcon status={t.status} />
              <span className={`flex-1 text-sm ${t.status === 'DONE' ? 'text-ink-faint line-through' : 'text-ink'}`}>
                {t.title}
              </span>
              <span className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${t.tagClass}`}>
                {t.tag}
              </span>
              <span className="hidden w-16 text-right font-mono text-[11px] text-ink-faint sm:block">{t.due}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
