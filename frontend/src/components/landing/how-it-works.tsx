'use client';

import { motion } from 'framer-motion';
import { KineticHeadline } from '@/components/motion/kinetic-headline';
import { Reveal } from '@/components/motion/reveal';

const STEPS = [
  {
    n: '01',
    title: 'Capture',
    body: 'Add a task in a keystroke. Title, priority, due date, notes — or just a title and go.',
  },
  {
    n: '02',
    title: 'Prioritise',
    body: 'Filter by status, search by name, and sort by what matters. Urgent rises to the top.',
  },
  {
    n: '03',
    title: 'Finish',
    body: 'Toggle done with a satisfying click. Watch your momentum bar fill as the backlog empties.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-24 overflow-hidden border-y border-line bg-surface/30 py-24 sm:py-32">
      <div className="container-page">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-eyebrow mb-3">The loop</p>
          <KineticHeadline
            text="Three moves. On repeat."
            as="h2"
            className="text-4xl font-medium tracking-[-0.03em] text-ink sm:text-5xl"
          />
        </Reveal>

        <div className="relative grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="group relative bg-surface p-8"
            >
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <h3 className="mt-4 font-display text-3xl text-ink">{s.title}</h3>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-ink-soft">{s.body}</p>
              <div className="mt-6 h-px w-0 bg-accent transition-all duration-500 group-hover:w-full" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
