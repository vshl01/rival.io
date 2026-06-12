'use client';

import { motion } from 'framer-motion';
import { ease } from '@/lib/motion';

const QUOTES = [
  'Capture it before it captures you.',
  'Urgent rises. Done disappears.',
  'A workspace as fast as you think.',
];

export function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden bg-surface lg:block">
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -right-20 top-1/3 h-[420px] w-[420px] rounded-full bg-accent/20 blur-[110px]" />

      <div className="relative flex h-full flex-col justify-between p-12">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-eyebrow"
        >
          Rival — task manager
        </motion.p>

        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease, delay: 0.1 }}
            className="font-display text-5xl leading-[1.05] text-ink xl:text-6xl"
          >
            Outpace your <span className="italic text-accent">day.</span>
          </motion.h2>
          <div className="mt-8 space-y-3">
            {QUOTES.map((q, i) => (
              <motion.div
                key={q}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.12, duration: 0.5, ease }}
                className="flex items-center gap-3 text-ink-soft"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {q}
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="rounded-2xl border border-line bg-canvas/60 p-4 backdrop-blur"
        >
          <p className="font-mono text-xs text-ink-faint">DEMO ACCOUNT</p>
          <p className="mt-1 text-sm text-ink">
            demo@rival.app · <span className="font-mono">Password123</span>
          </p>
        </motion.div>
      </div>
    </aside>
  );
}
